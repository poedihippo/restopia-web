import { IListParams } from "@/@types/global";
import { useCallback, useEffect, useMemo, useState } from "react";

interface Meta {
  current_page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
}

interface UseDataTableOptions {
  defaultPerPage?: number;
  defaultSort?: string;
  debounceMs?: number;
  extraParams?: Record<string, unknown>;
}

const useDataTable = (options?: UseDataTableOptions) => {
  const {
    defaultPerPage = 1000,
    defaultSort = "-id",
    debounceMs = 500,
    extraParams,
  } = options ?? {};

  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(defaultPerPage);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const queryParams = useMemo<IListParams>(
    () => ({
      page: currentPage,
      per_page: perPage,
      "filter[search]": debouncedSearch || undefined,
      sort: defaultSort,
      ...extraParams,
    }),
    [currentPage, perPage, debouncedSearch, defaultSort, extraParams],
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
  }, []);

  const buildPagination = useCallback(
    (meta?: Meta) => ({
      current: meta?.current_page ?? 1,
      pageSize: meta?.per_page ?? perPage,
      total: meta?.total ?? 0,
      onChange: handlePageChange,
      onPageSizeChange: handlePerPageChange,
    }),
    [perPage, handlePageChange, handlePerPageChange],
  );

  const handleSearch = useCallback((searchTerm: string) => {
    setSearch(searchTerm);
    setCurrentPage(1);
  }, []);

  return {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handlePerPageChange,
    handleSearch,
  };
};

export default useDataTable;
