// The v2 design (src/styles/ui-v2.css) is on for every page rendered inside
// GlobalLayout. List a pathname here only to keep that page on the legacy look.
export const UI_V2_OPT_OUT_ROUTES: string[] = []

export const isUiV2Route = (pathname: string): boolean => !UI_V2_OPT_OUT_ROUTES.includes(pathname)
