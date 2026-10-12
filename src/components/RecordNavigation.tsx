import { NavLink } from 'react-router-dom'

export default function RecordNavigation() {
  return (
    <nav aria-label="学习记录分类" className="wenyan-record-tabs">
      <NavLink to="/analysis">学习概况</NavLink>
      <NavLink to="/error-book">拼写错词</NavLink>
    </nav>
  )
}
