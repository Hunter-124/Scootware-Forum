import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 mins
    }
  });

  const invalidateAuth = () => {
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    error,
    invalidateAuth
  };
}
