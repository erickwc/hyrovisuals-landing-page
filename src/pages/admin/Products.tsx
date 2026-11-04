import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { fetchProductOptions, type ProductOption } from "../../lib/admin-data";
import { NewProductPanel } from "./NewProductPanel";
import { lastProductId } from "./ProductAdmin";
import { Button } from "../../components/Button";
import { PlusSign } from "../../components/animate-ui/icons/hugeicons/plus-sign";

// Entrada a Productos: abre el último producto revisado (o el primero). Sin productos, invita a crear uno.
export function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  // cada apertura arranca con el formulario vacío
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    fetchProductOptions()
      .then(setProducts)
      .catch(() => setFailed(true));
  }, []);

  if (products && products.length > 0) {
    const last = lastProductId();
    const target = products.find((p) => p.id === last) ?? products[0];
    return <Navigate to={`/admin/productos/${target.id}`} replace />;
  }

  return (
    <div className="admin__page">
      <div className="admin__head">
        <h1 className="admin__title">Productos</h1>
      </div>
      <div className="board__filters">
        <div className="board__end">
          <div className="mini-anchor">
            <Button
              size="sm"
              data-mini-trigger
              aria-expanded={creating}
              onClick={() => {
                if (!creating) setFormKey((k) => k + 1);
                setCreating((v) => !v);
              }}
            >
              <PlusSign size={14} />
              Nuevo producto
            </Button>
            <NewProductPanel key={formKey} open={creating} onClose={() => setCreating(false)} onCreated={(created) => navigate(`/admin/productos/${created.id}`)} />
          </div>
        </div>
      </div>
      <div className="admin__content">
        <div className="admin-empty">
          {failed ? "No pudimos cargar los productos." : products ? "Todavía no hay productos. Crea el primero con Nuevo producto." : "Cargando productos…"}
        </div>
      </div>
    </div>
  );
}
