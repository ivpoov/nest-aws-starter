import type { ReactElement } from 'react';
import { PRODUCT_NAME } from '../../constants/product.constants';

// The logo slot. It renders the product name as text because a starter has no
// logo to ship and a placeholder image would be worse than none — swap the
// span for an <img> or an inline SVG and every screen that shows the brand
// follows, because they all render this.
export function Brand(): ReactElement {
  return (
    <div className="mb-6 text-center">
      <span className="text-xl font-semibold tracking-tight text-content">{PRODUCT_NAME}</span>
    </div>
  );
}
