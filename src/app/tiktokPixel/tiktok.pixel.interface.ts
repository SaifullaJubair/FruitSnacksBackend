export interface ITikTokEventData {
  event_name: string;
  event_id: string;
  event_source_url?: string;
  user_data: {
    client_ip_address?: string;
    client_user_agent?: string;
    phone?: string; // hashed
    email?: string; // hashed
    external_id?: string; // hashed
  };
  properties?: {
    currency?: string;
    value?: number;
    content_id?: string;
    content_name?: string;
    content_type?: string;
    quantity?: number;
    order_id?: string;
    query?: string;
  };
}
