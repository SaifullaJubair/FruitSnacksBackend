export interface MetaEventData {
  event_name: string;
  event_id: string;
  event_source_url?: string;
  user_data: {
    client_ip_address?: string;
    client_user_agent?: string;
    ph?: string; // phone (raw, BE hashes)
    em?: string; // email (raw, BE hashes)
    fn?: string; // first name (raw, BE hashes) — Phase 1B split from full name
    ln?: string; // last name (raw, BE hashes) — Phase 1B
    ct?: string; // city (raw, BE hashes)        — Phase 1B EMQ boost
    st?: string; // state/region (raw, BE hashes) — Phase 1B
    zp?: string; // zip / postcode (raw, BE hashes) — Phase 1B (not collected in BD form)
    country?: string; // 2-letter ISO lowercase, e.g. "bd" — Phase 1B
    external_id?: string; // user_id (raw, BE hashes)
    fbc?: string; // fb click id cookie (sent as-is, no hash)
    fbp?: string; // fb browser id cookie (sent as-is, no hash)
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_type?: string;
    content_name?: string;
    content_category?: string;
    num_items?: number;
    order_id?: string;
  };
  action_source: "website";
}
