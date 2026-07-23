export const cookies = {
  get(name: string): string | undefined {
    if (typeof window === "undefined") return undefined;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) {
      return parts.pop()?.split(";").shift();
    }
    return undefined;
  },

  set(
    name: string,
    value: string,
    options: {
      expires?: number | Date;
      path?: string;
      domain?: string;
      secure?: boolean;
      sameSite?: "strict" | "lax" | "none";
    } = {},
  ): void {
    if (typeof window === "undefined") return;

    let cookieString = `${name}=${value}`;

    if (options.expires) {
      const expires =
        typeof options.expires === "number"
          ? new Date(Date.now() + options.expires * 864e5) // days to milliseconds
          : options.expires;
      cookieString += `; expires=${expires.toUTCString()}`;
    }

    cookieString += `; path=${options.path || "/"}`;

    if (options.domain) {
      cookieString += `; domain=${options.domain}`;
    }

    if (options.secure) {
      cookieString += "; secure";
    }

    if (options.sameSite) {
      cookieString += `; samesite=${options.sameSite}`;
    }

    document.cookie = cookieString;
  },

  remove(
    name: string,
    options: {
      path?: string;
      domain?: string;
      secure?: boolean;
      sameSite?: "strict" | "lax" | "none";
    } = {}
  ): void {
    if (typeof window === "undefined") return;

    this.set(name, "", {
      ...options,
      expires: new Date(0),
    });
  },
};
