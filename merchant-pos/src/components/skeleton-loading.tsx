import Skeleton, { SkeletonTheme } from "react-loading-skeleton";

interface Props {
  height?: number;
  width?: number;
}
const SkeletonLoading = ({ height, width }: Props) => {
  return (
    <SkeletonTheme
      baseColor="#121212"
      highlightColor="rgba(255,255,255,0.1)"
      height={height}
      width="100%"
    >
      <Skeleton
        containerClassName="flex-1"
        count={1}
        duration={2}
        style={{ borderRadius: "8px", width: width + "px" }}
      />
    </SkeletonTheme>
  );
};

export default SkeletonLoading;
