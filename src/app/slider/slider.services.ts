import { ISliderInterface } from "./slider.interface";
import SliderModel from "./slider.model";

// Find A Slider with serial
export const findASliderSerialServices = async (
    slider_serial: number
): Promise<ISliderInterface | null> => {
    const findSlider: ISliderInterface | null = await SliderModel.findOne({
        slider_serial: slider_serial,
    });
    return findSlider;
};

// Create A Slider
export const postSliderServices = async (
    data: ISliderInterface
): Promise<ISliderInterface | {}> => {
    const createSlider: ISliderInterface | {} = await SliderModel.create(
        data
    );
    return createSlider;
};

// Find Slider
export const findAllSliderServices = async (): Promise<
    ISliderInterface[] | []
> => {
    const findSlider: ISliderInterface[] | [] = await SliderModel.find({
        slider_status: "active",
    })
        .sort({ slider_serial: 1 })
        .select("-__v");
    return findSlider;
};

// Find all dashboard Slider
export const findAllDashboardSliderServices = async (
    limit: number,
    skip: number
): Promise<ISliderInterface[] | []> => {
    const findSlider: ISliderInterface[] | [] = await SliderModel.find(
        {}
    )
        .sort({ slider_serial: 1 })
        .skip(skip)
        .limit(limit)
        .select("-__v");
    return findSlider;
};

// Update a Slider
export const updateSliderServices = async (
    data: ISliderInterface,
    _id: string
): Promise<ISliderInterface | any> => {
    const updateSliderInfo: ISliderInterface | null =
        await SliderModel.findOne({ _id: _id });
    if (!updateSliderInfo) {
        return {};
    }
    const Slider = await SliderModel.updateOne({ _id: _id }, data, {
        runValidators: true,
    });
    return Slider;
};

// Delete a Slider
export const deleteSliderServices = async (
    _id: string
): Promise<ISliderInterface | any> => {
    const Slider = await SliderModel.deleteOne(
        { _id: _id },
        {
            runValidators: true,
        }
    );
    return Slider;
};
