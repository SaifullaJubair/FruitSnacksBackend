const mongoose = require("mongoose");

// const uri = `mongodb+srv://saifullajubair6:o89AfmHshyzDnAi0@cluster0.xxqcwqo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = process.env.MONGO_URI as string;
function connectDB() {
  mongoose.set("strictQuery", false);
  const time = new Date().toLocaleTimeString();
  const date = new Date().toLocaleString("en-us", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  mongoose
    .connect(uri)
    .then(() => {
      console.log(
        "\x1b[36m%s\x1b[0m",
        "[FC]",
        time,
        ":",
        date,
        ": Database is connected Successfully",
      );
    })
    .catch((err: Error) => {
      console.error(`Error connecting to MongoDB: ${err.message}`);
    });
}

export default connectDB;
