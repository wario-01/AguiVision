import Mux from "@mux/mux-node";

const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;

export const isMuxConfigured = Boolean(tokenId && tokenSecret);

export const mux = isMuxConfigured ? new Mux({ tokenId, tokenSecret }) : null;
