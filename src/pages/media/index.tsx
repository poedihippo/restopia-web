import { GlobalLayout } from "@/components/global-layout";
import Media from "@/views/Media";

export default function MediaPage() {
  return (
    <GlobalLayout name="Media" breadcrumb={["Media"]}>
      <Media />
    </GlobalLayout>
  )
}
