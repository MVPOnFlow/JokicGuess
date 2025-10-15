import * as fcl from "@onflow/fcl";
import { init } from "@onflow/fcl-wc";

const WC_PROJECT_ID = "958ae97fbbc50c43c633aa1bcf5959ee";

// 1️⃣ Standard FCL configuration
fcl.config()
  .put("app.detail.title", "Flow Jukebox")
  .put("app.detail.icon", "https://raw.githubusercontent.com/bogdang989/FlowJukeBoxNFT/refs/heads/main/FlowJukeboxLogo.png")
  .put("accessNode.api", "https://rest-testnet.onflow.org")
  .put("discovery.wallet", "https://fcl-discovery.onflow.org/authn")
  .put("flow.network", "testnet")
  .put("discovery.authn.include", ["0x33f75ff0b830dcec"])
  .put("discovery.authn.exclude", ["0x95b85a9ef4daabb1", "0x55ad22f01ef568a1"]);

// 2️⃣ Add WalletConnect 2.0 support
init({
  projectId: WC_PROJECT_ID,
  metadata: {
    name: "Flow Jukebox",
    description: "Online jukebox powered by Flow blockchain",
    url: "https://raw.githubusercontent.com/bogdang989/FlowJukeBoxNFT/refs/heads/main/FlowJukeboxLogo.png",
    icons: ["https://raw.githubusercontent.com/bogdang989/FlowJukeBoxNFT/refs/heads/main/FlowJukeboxLogo.png"]
  }
}).then(({ FclWcServicePlugin }) => {
  fcl.pluginRegistry.add(FclWcServicePlugin);
});
