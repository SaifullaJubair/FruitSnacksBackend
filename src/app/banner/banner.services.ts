import { IBannerInterface } from "./banner.interface";
import BannerModel from "./banner.model";

// Find A Banner with serial
export const findABannerSerialServices = async (
    banner_serial: number
): Promise<IBannerInterface | null> => {
    const findBanner: IBannerInterface | null = await BannerModel.findOne({
        banner_serial: banner_serial,
    });
    return findBanner;
};

// Create A Banner
export const postBannerServices = async (
    data: IBannerInterface
): Promise<IBannerInterface | {}> => {
    const createBanner: IBannerInterface | {} = await BannerModel.create(
        data
    );
    return createBanner;
};

// Find Banner
export const findAllBannerServices = async (): Promise<
    IBannerInterface[] | []
> => {
    const findBanner: IBannerInterface[] | [] = await BannerModel.find({
        banner_status: "active",
    })
        .sort({ banner_serial: 1 })
        .select("-__v");
    return findBanner;
};

// Find all dashboard Banner
export const findAllDashboardBannerServices = async (
    limit: number,
    skip: number
): Promise<IBannerInterface[] | []> => {
    const findBanner: IBannerInterface[] | [] = await BannerModel.find(
        {}
    )
        .sort({ banner_serial: 1 })
        .skip(skip)
        .limit(limit)
        .select("-__v");
    return findBanner;
};

// Update a Banner
export const updateBannerServices = async (
    data: IBannerInterface,
    _id: string
): Promise<IBannerInterface | any> => {
    const updateBannerInfo: IBannerInterface | null =
        await BannerModel.findOne({ _id: _id });
    if (!updateBannerInfo) {
        return {};
    }
    const Banner = await BannerModel.updateOne({ _id: _id }, data, {
        runValidators: true,
    });
    return Banner;
};

// Delete a Banner
export const deleteBannerServices = async (
    _id: string
): Promise<IBannerInterface | any> => {
    const Banner = await BannerModel.deleteOne(
        { _id: _id },
        {
            runValidators: true,
        }
    );
    return Banner;
};
