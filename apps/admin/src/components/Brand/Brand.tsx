import type { ReactElement } from 'react';
import { ADMIN_PRODUCT_NAME } from '../../constants/product.constants';

// The logo slot, as in apps/web — text because a starter has no logo to ship.
// `isCompact` is the sidebar's rendering: same source, smaller and left-aligned,
// so the console header and the login screen cannot drift apart.
export function Brand({ isCompact = false }: { readonly isCompact?: boolean }): ReactElement {
  if (isCompact) {
    return <p className="mb-6 text-sm font-semibold">{ADMIN_PRODUCT_NAME}</p>;
  }

  return (
    <div className="mb-6 text-center">
      <span className="text-xl font-semibold tracking-tight text-content">
        {ADMIN_PRODUCT_NAME}
      </span>
    </div>
  );
}
