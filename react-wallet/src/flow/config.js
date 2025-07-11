import * as fcl from "@onflow/fcl";

fcl.config()
  .put("app.detail.title", "MVP on Flow")
  .put("app.detail.icon", "/favicon.png")
  .put("accessNode.api", "https://rest-mainnet.onflow.org")
  .put("discovery.wallet", "https://fcl-discovery.onflow.org/authn")
  .put("flow.network", "mainnet");