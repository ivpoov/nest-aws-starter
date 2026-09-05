// The one place a fork renames the product. The admin console derives its own
// name from the same variable rather than carrying a second one, so the two
// apps cannot end up disagreeing about what the product is called.
export const PRODUCT_NAME: string =
  (import.meta.env.VITE_PRODUCT_NAME as string | undefined) ?? 'Starter';

export const ADMIN_PRODUCT_NAME: string = `${PRODUCT_NAME} Admin`;
