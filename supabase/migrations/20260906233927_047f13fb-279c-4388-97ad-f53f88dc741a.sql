REVOKE EXECUTE ON FUNCTION public.check_and_send_stock_alert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_critical_notification_email() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_profile_activated() FROM anon, authenticated;