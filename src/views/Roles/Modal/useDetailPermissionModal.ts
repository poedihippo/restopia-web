import { IRole } from "@/@types/role";
import { useCallback, useState } from "react";

const useDetailPermissionModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IRole | null>(null);

  const openModal = useCallback((item: IRole) => {
    setSelected(item);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelected(null);
  }, []);

  return {
    isOpen,
    selected,
    openModal,
    closeModal,
  };
};

export default useDetailPermissionModal;
