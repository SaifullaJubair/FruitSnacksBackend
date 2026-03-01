export interface IPageSeo {
  _id?: any;
  page_key: string;
  path?: string; // Make optional with ?
  title: string;
  description: string;
  noIndex: boolean;
  updatedAt?: Date;
}
