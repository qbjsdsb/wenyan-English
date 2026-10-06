// Wenyan keeps this compatibility function because upstream UI code still calls it.
// Personal study and promotion interactions are intentionally not sent to Vercel
// Analytics, Google Analytics, or another third-party telemetry service.
export const trackPromotionEvent = (event: string, properties: Record<string, string>) => {
  void event
  void properties
}
