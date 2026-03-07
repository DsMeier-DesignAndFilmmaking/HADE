import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any) {
  // 1. If we are already there, stop.
  if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === name) {
    return;
  }

  // 2. High-resilience polling for stack swaps
  let attempts = 0;
  const maxAttempts = 10; // Increased to 1 second total (10 * 100ms)
  
  const interval = setInterval(() => {
    if (navigationRef.isReady()) {
      const state = navigationRef.getRootState();
      // Check if the route exists in the newly mounted stack
      const hasRoute = state?.routeNames?.includes(name) || 
                        state?.routes?.some(r => r.name === name);

      if (hasRoute) {
        navigationRef.dispatch(CommonActions.navigate({ name, params }));
        clearInterval(interval);
      }
    }

    attempts++;
    if (attempts >= maxAttempts) {
      console.warn(`[NavRef] Could not find route "${name}" in the current mounted stack.`);
      clearInterval(interval);
    }
  }, 100);
}