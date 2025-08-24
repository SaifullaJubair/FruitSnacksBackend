export interface IBannerInterface {
  _id?: any;
  banner_image: string;
  banner_title: string;
  banner_image_key: string;
  banner_status: "active" | "in-active";
  banner_path?: string;
  banner_serial: number;
}