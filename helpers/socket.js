let ioInstance = null;

exports.setIO = (io) => {
  ioInstance = io;
};

exports.getIO = () => ioInstance;

exports.emitMateAvailabilityTracking = (payload) => {
  if (!ioInstance) return;
  ioInstance.to("admin_mate_tracking").emit("mate_availability_tracking", payload);
};
