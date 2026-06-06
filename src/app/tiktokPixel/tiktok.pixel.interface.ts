export interface ITikTokEventData {
  event_name: string;
  event_id: string;
  event_source_url?: string;
  user_data: {
    client_ip_address?: string;
    client_user_agent?: string;
    phone?: string; // raw, BE hashes
    email?: string; // raw, BE hashes
    // Phase 1B EMQ — TikTok docs list these as part of `user` object.
    first_name?: string;
    last_name?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    country?: string; // ISO lowercase
    external_id?: string;
    ttclid?: string; // TikTok click id (cookie / URL param)
    ttp?: string; // TikTok browser id
  };
  properties?: {
    currency?: string;
    value?: number;
    content_id?: string;
    content_name?: string;
    content_type?: string;
    content_category?: string;
    quantity?: number;
    order_id?: string;
    query?: string;
  };
}
