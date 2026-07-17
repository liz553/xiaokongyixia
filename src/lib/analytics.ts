export const trackEvent = (eventName: string, payload: any = {}) => {
  try {
    const events = JSON.parse(localStorage.getItem('app_analytics_events') || '[]');
    const userStateStr = localStorage.getItem('userState');
    const userState = userStateStr ? JSON.parse(userStateStr) : {};
    const token = localStorage.getItem('token');
    
    events.push({
      event_name: eventName,
      timestamp: new Date().toISOString(),
      user_type: token ? 'logged' : 'visitor',
      user_id: userState?.profile?.username || 'anonymous',
      page_path: window.location.pathname,
      ...payload
    });
    localStorage.setItem('app_analytics_events', JSON.stringify(events));
  } catch (e) {
    // silently fail
  }
};
