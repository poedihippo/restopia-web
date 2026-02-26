import { GlobalLayout } from "@/components/global-layout";
import Recipes from "@/views/Recipes";

const RecipesPage = () => {
  return (
    <GlobalLayout name="Recipes" breadcrumb={["Recipes"]}>
      <Recipes />
    </GlobalLayout>
  );
};

export default RecipesPage;
