import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // data fresh for 5                                                   minutes
      gcTime:    30 * 60 * 1000,   // keep in memory 30                                           minutes
      retry: 1,
    },
  },
});