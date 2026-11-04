// Ruta de un archivo de /public respetando la base del despliegue (import.meta.env.BASE_URL).
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, "");
