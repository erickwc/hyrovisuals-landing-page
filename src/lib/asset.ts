// Ruta de un archivo de /public respetando la base del despliegue ("/" o "/web3/").
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, "");
