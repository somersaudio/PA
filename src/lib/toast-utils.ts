import { toast } from "sonner";

export function toastError(message: string) {
  toast.error(message, {
    action: {
      label: "Copy",
      onClick: () => {
        navigator.clipboard.writeText(message);
        toast.success("Error copied to clipboard");
      },
    },
  });
}
