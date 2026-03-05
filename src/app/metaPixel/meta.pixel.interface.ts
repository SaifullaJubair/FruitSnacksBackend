export interface MetaEventData {
  event_name: string;
  event_id: string;
  event_source_url?: string;
  user_data: {
    client_ip_address?: string;
    client_user_agent?: string;
    ph?: string; // phone (hashed)
    em?: string; // email (hashed)
    fn?: string; // first name (hashed)
    external_id?: string; // user_id (hashed)
    fbc?: string; // fb click id cookie
    fbp?: string; // fb browser id cookie
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_type?: string;
    content_name?: string;
    num_items?: number;
    order_id?: string;
  };
  action_source: "website";
}
