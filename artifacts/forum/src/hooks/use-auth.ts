import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 mins
    } as any
  });

  const invalidateAuth = () => {
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isModerator: user?.role === 'mod',
    hasAdminPanelAccess: user?.role === 'admin' || user?.role === 'mod',
    error,
    invalidateAuth,
    isSubscribed: (productId?: string) => {
      if (!productId) return false;
      if (!user) return false;
      
      // Check legacy upgradeType first
      if (user.upgradeType && user.upgradeType !== productId) return false;
      if (user.upgradeType === productId) {
        if (!user.upgradeExpiresAt) return true;
        try {
          return new Date(user.upgradeExpiresAt) > new Date();
        } catch {
          return false;
        }
      }
      
      // Check new productAccess list
      if (user.productAccess && Array.isArray(user.productAccess)) {
        const access = user.productAccess.find(p => p.productId === productId);
        if (access && access.expiresAt) {
          try {
            return new Date(access.expiresAt) > new Date();
          } catch {
            return false;
          }
        }
      }
      
      return false;
    }
  };
}
