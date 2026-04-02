import ReceiptsDetail from "@/views/Receipts/Detail/ReceiptsDetail";
import { useRouter } from "next/router";

const ReceiptsDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return <ReceiptsDetail id={Number(id)} />;
};

export default ReceiptsDetailPage;
