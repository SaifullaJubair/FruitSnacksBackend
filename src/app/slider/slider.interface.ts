export interface ISliderInterface {
  _id?: any;
  slider_image: string;
  slider_image_key: string;
  slider_status: "active" | "in-active";
  slider_path?: string;
  slider_serial: number;
  // Demo-seed marker — cleared by "Clear demo data".
  is_demo?: boolean;
}