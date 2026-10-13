#!/usr/bin/env python3
"""Convert local ESQ reading_a units to Wenyan packs; no network or source modification."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

MAX_FILE = 20 * 1024 * 1024
MAX_PACK = 8 * 1024 * 1024


def digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def dumps(value):
    return json.dumps(value, ensure_ascii=False, indent=2)


def nonempty(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{label}: missing text')
    return value.strip()


def convert(args):
    if args.output.exists():
        raise ValueError('Output directory already exists; choose a new directory to preserve prior exports.')
    if not re.match(r'^https?://', args.source_url):
        raise ValueError('--source-url must be an HTTP(S) source reference.')
    if args.input.stat().st_size > 100 * 1024 * 1024:
        raise ValueError('ESQ exceeds 100 MiB.')
    report = {'sourceUrl': args.source_url, 'sourceRevision': args.source_revision, 'inputSha256': hashlib.sha256(args.input.read_bytes()).hexdigest(),
              'converted': 0, 'skipped': [], 'warnings': ['Answers are source-provided, not independently verified.'], 'files': []}
    outputs = {}
    seen_units = set()
    with ZipFile(args.input) as archive:
        names = set()
        total = 0
        for info in archive.infolist():
            path = PurePosixPath(info.filename)
            if info.filename in names or path.is_absolute() or '..' in path.parts or '\\' in info.filename or ':' in info.filename:
                raise ValueError('Unsafe or duplicate archive path.')
            names.add(info.filename)
            total += info.file_size
            if info.file_size > MAX_FILE or info.flag_bits & 1 or ((info.external_attr >> 16) & 0o170000) == 0o120000:
                raise ValueError('Oversized, encrypted or symlink archive member.')
        if len(names) > 1000 or total > 100 * 1024 * 1024:
            raise ValueError('Archive exceeds resource limits.')

        def read_json(path):
            if path not in names or not path.endswith('.json'):
                raise ValueError(f'Missing JSON member: {path}')
            return json.loads(archive.read(path).decode('utf-8-sig'))

        manifest = read_json('manifest.json')
        if manifest.get('format') != 'esq' or manifest.get('schemaVersion') not in ('1.0', '1.1'):
            raise ValueError('Only ESQ 1.0 / 1.1 is supported.')
        license_data = manifest.get('license', {})
        notice = dumps(license_data) if license_data else 'Source did not declare a content license.'
        if len(notice) > 8000:
            raise ValueError('License notice exceeds supported size; preserve it separately before conversion.')
        report['license'] = license_data
        report['source'] = manifest.get('source')
        report['packageId'] = manifest.get('packageId')
        report['contentVersion'] = manifest.get('contentVersion')
        for entry in manifest['papers']:
            if args.year and entry['year'] not in args.year:
                continue
            paper = read_json(entry['path'])
            answer_sheet = read_json(entry['answerPath'])
            if paper.get('paperKey') != entry['paperKey'] or answer_sheet.get('paperKey') != entry['paperKey']:
                raise ValueError('Paper / answer identifiers disagree.')
            year = paper.get('year')
            if type(year) is not int or not 1980 <= year <= 2100 or year != entry['year']:
                raise ValueError('Paper year is invalid or mismatched.')
            passages = []
            for unit in paper['units']:
                unit_key = nonempty(unit.get('unitKey'), 'unitKey')
                if unit_key in seen_units:
                    raise ValueError(f'Duplicate unitKey: {unit_key}')
                seen_units.add(unit_key)
                if unit.get('type') != 'reading' or unit.get('subtype') != 'reading_a':
                    report['skipped'].append({'unitKey': unit_key, 'reason': 'unsupported_activity', 'type': unit.get('type')})
                    continue
                try:
                    blocks = unit['passage']['blocks']
                    if any(block.get('type') not in ('paragraph', 'quote', 'separator') for block in blocks):
                        raise ValueError('non_text_blocks_require_manual_review')
                    paragraphs = [nonempty(block.get('text'), 'paragraph') for block in blocks if block['type'] != 'separator']
                    if not paragraphs or len(paragraphs) > 100 or any(len(p) > 20000 for p in paragraphs):
                        raise ValueError('invalid_passage_length')
                    questions = []
                    question_ids = set()
                    for question in unit['questions']:
                        if question.get('type') != 'single_choice':
                            raise ValueError('unsupported_question_type')
                        question_key = nonempty(question.get('questionKey'), 'questionKey')
                        if question_key in question_ids:
                            raise ValueError('duplicate_question_key')
                        question_ids.add(question_key)
                        options = [{'id': nonempty(option.get('key'), 'option key'), 'text': nonempty(option.get('content'), 'option text')}
                                   for option in question['options']]
                        keys = [option['id'] for option in options]
                        answer = answer_sheet['answers'].get(question_key, {}).get('correctOption')
                        if not 2 <= len(options) <= 10 or len(set(keys)) != len(keys) or answer not in keys:
                            raise ValueError('missing_or_invalid_answer')
                        if any(not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,179}', key) for key in keys) or any(len(option['text']) > 4000 for option in options):
                            raise ValueError('unsupported_option')
                        stem = nonempty(question.get('stem'), 'question stem')
                        if len(stem) > 6000:
                            raise ValueError('question_stem_too_long')
                        questions.append({'id': 'q-' + digest(question_key)[:24], 'type': 'single_choice', 'stem': stem,
                                          'options': options, 'correctOptionId': answer})
                    if not 1 <= len(questions) <= 40:
                        raise ValueError('invalid_question_count')
                    content = {'paragraphs': paragraphs, 'questions': questions}
                    passages.append({
                        'id': f"esq-{args.paper}-" + digest(args.source_url + '\n' + unit_key)[:24],
                        'version': 'content-' + digest(dumps(content))[:24],
                        'title': f"{year} · {nonempty(unit.get('title'), 'unit title')}"[:200],
                        'exam': {'paper': args.paper, 'year': year},
                        'source': {'kind': 'private-import', 'label': f"{manifest.get('title', 'ESQ')} · {unit_key}"[:500],
                                   'reference': args.source_url, 'revision': args.source_revision, 'license': notice},
                        **content, 'estimatedMinutes': 18, 'recommendationEligible': False,
                    })
                except (KeyError, TypeError, ValueError) as error:
                    report['skipped'].append({'unitKey': unit_key, 'reason': str(error)})
            if passages:
                pack = {'format': 'wenyan-reading-pack', 'schemaVersion': 1,
                        'title': f"{year} · {'英语一' if args.paper == 'english-1' else '英语二'} · 阅读", 'passages': passages}
                encoded = dumps(pack)
                if len(passages) > 200 or len(encoded.encode('utf-8')) > MAX_PACK:
                    raise ValueError('Converted paper exceeds Wenyan pack limits.')
                filename = f"{args.paper}-{year}-{digest(entry['paperKey'])[:8]}.json"
                if filename in outputs:
                    raise ValueError('Duplicate output paper.')
                outputs[filename] = encoded
                report['converted'] += len(passages)
                report['files'].append(filename)
    if not outputs:
        raise ValueError('No complete, supported reading units found; nothing was written.')
    args.output.mkdir(parents=True)
    for filename, content in outputs.items():
        (args.output / filename).write_text(content, encoding='utf-8')
    (args.output / 'conversion-report.json').write_text(dumps(report), encoding='utf-8')
    print(f"Converted {report['converted']} reading passages; skipped {len(report['skipped'])} units. See conversion-report.json.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--paper', required=True, choices=['english-1', 'english-2'])
    parser.add_argument('--source-url', required=True)
    parser.add_argument('--source-revision', required=True)
    parser.add_argument('--year', type=int, action='append', help='Repeat to select years; omitted means all.')
    try:
        convert(parser.parse_args())
    except (ValueError, KeyError, TypeError, OSError) as error:
        parser.exit(1, f'Conversion stopped: {error}\n')
