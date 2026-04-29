// let isRefreshing = false;
// let pendingRequests: ((value?: unknown) => void)[] = [];

// const BASE_URL = 'http://192.168.0.177:8000/api/v1';

// export async function refreshAccessToken() {
//   const res = await fetch(`${BASE_URL}/auth/refresh_token`, {
//     method: "POST",
//     credentials: "include",
//   });
//   if (!res.ok) {
//     const err = await res.json();
//     console.log("refresh error: ", err);
//     throw new Error("Failed to refresh token");
//   }
  
//   pendingRequests.forEach((cb) => cb());
//   pendingRequests = [];
//   return true;
// }

// // main fetcher
// export async function apiFetch(
//   endpoint: string,
//   options: RequestInit = {}
// ): Promise<Response> {
//   const headers = new Headers(options.headers || {});
  
//   // Only set application/json for non-FormData bodies.
//   // For FormData the browser sets Content-Type automatically with the correct multipart boundary.
//   if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
//     headers.set("Content-Type", "application/json");
//   }

//   // Ensure cookies are sent with every single request!
//   options.credentials = "include";

//   const res = await fetch(`${BASE_URL}${endpoint}`, {
//     ...options,
//     headers,
//   });

//   // refresh token interceptor
//   if (res.status === 401 && !endpoint.includes("/auth/refresh_token")) {
//     if (!isRefreshing) {
//       isRefreshing = true;
//       try {
//         await refreshAccessToken();
//       } catch (error) {
//         isRefreshing = false;
//         throw new Error("session expired");
//       }
//       isRefreshing = false;
//     } else {
//       await new Promise((resolve) => pendingRequests.push(resolve));
//     }

//     // retry original fetch
//     const retryHeaders = new Headers(options.headers || {});
    
//     // Make sure we have the application/json header on retries too (not for FormData)
//     if (options.body && !(options.body instanceof FormData) && !retryHeaders.has("Content-Type")) {
//       retryHeaders.set("Content-Type", "application/json");
//     }

//     const retryRes = await fetch(`${BASE_URL}${endpoint}`, {
//       ...options,
//       headers: retryHeaders,
//     });

//     return retryRes;
//   }

//   return res;
// }




let isRefreshing = false;
let pendingRequests: (() => void)[] = [];

const BASE_URL =
  `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/v1`;

// 🔁 Refresh access token (cookie-based)
async function refreshAccessToken() {
  const res = await fetch(`${BASE_URL}/auth/refresh_token`, {
    method: "POST",
    credentials: "include", // 🔥 REQUIRED
  });
  console.log("REFRESH STATUS:", res.status);

  const data = await res.text();
  console.log("REFRESH RESPONSE:", data);

  if (!res.ok) {
    throw new Error("Refresh failed");
  }

  // 🔥 Wake up all queued requests
  pendingRequests.forEach((cb) => cb());
  pendingRequests = [];
}

// 🚀 Main API fetcher
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers || {});

  // Only set JSON header if NOT FormData
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include", 
  });

  // 🔁 HANDLE AUTH FAILURE
  if (
    (res.status === 401 || res.status === 403) &&
    !endpoint.includes("/auth/refresh_token")
  ) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        await refreshAccessToken();
      } catch (err) {
        isRefreshing = false;

        // 🔥 HARD FAIL → redirect scenario
        throw new Error("Session expired");
      }

      isRefreshing = false;
    } else {
      // wait for refresh to finish
      await new Promise<void>((resolve) => pendingRequests.push(resolve));
    }

    // 🔁 RETRY ORIGINAL REQUEST
    const retryHeaders = new Headers(options.headers || {});

    if (
      options.body &&
      !(options.body instanceof FormData) &&
      !retryHeaders.has("Content-Type")
    ) {
      retryHeaders.set("Content-Type", "application/json");
    }

    const retryRes = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: retryHeaders,
      credentials: "include", // 🔥 DON'T MISS THIS
    });

    return retryRes;
  }

  return res;
}