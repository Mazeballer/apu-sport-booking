import { toast } from "sonner";

export const notify = {
  success: (msg: string) =>
    toast.success(msg, {
      style: {
        background: "#064E3B", // dark green
        color: "#ECFDF5",
        border: "1px solid #047857",
      },
    }),
  warning: (msg: string) =>
    toast.warning(msg, {
      style: {
        background: "#78350F", // amber brown
        color: "#FEF3C7",
        border: "1px solid #F59E0B",
      },
    }),
  error: (msg: string) =>
    toast.error(msg, {
      style: {
        background: "#7F1D1D", // dark red
        color: "#FEE2E2",
        border: "1px solid #DC2626",
      },
    }),
  info: (msg: string) =>
    toast(msg, {
      icon: "ℹ️",
      style: {
        background: "#0A66C2", // APU blue
        color: "#E6F0FF",
        border: "1px solid #084A9E",
      },
    }),
};
