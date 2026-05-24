import colors from "@/constants/colors";

// WIB is dark-only — always return the dark palette
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
