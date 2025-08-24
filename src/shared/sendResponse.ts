import { Response } from "express";

type IApiReponse<T> = {
  statusCode: number;
  success: boolean;
  message?: string | null;
  data?: T | null;
  totalData?: number;
};

// Send Success Response In FrontEnd
const sendResponse = <T>(res: Response, data: IApiReponse<T>): void => {
  const responseData: IApiReponse<T> = {
    statusCode: data.statusCode,
    success: data.success,
    message: data.message || null,
    data: data.data || null || undefined,
    totalData: data.totalData || null || undefined,
  };

  res.status(data.statusCode).json(responseData);
};

export default sendResponse;
