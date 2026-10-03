/**
 * Exact US company-name map for headline tagging (F3.5): the default US
 * watchlist (US_STREET_SYMBOLS), the official universe and the robotics US
 * seed. Data only. Names are matched case-sensitively on word boundaries.
 */
export const US_COMPANY_NAMES: { symbol: string; names: string[] }[] = [
  { symbol: "NVDA", names: ["Nvidia", "NVIDIA"] },
  { symbol: "AAPL", names: ["Apple"] },
  { symbol: "MSFT", names: ["Microsoft"] },
  { symbol: "AMZN", names: ["Amazon"] },
  { symbol: "GOOGL", names: ["Alphabet", "Google"] },
  { symbol: "META", names: ["Meta Platforms"] },
  { symbol: "AVGO", names: ["Broadcom"] },
  { symbol: "TSLA", names: ["Tesla"] },
  { symbol: "AMD", names: ["Advanced Micro Devices"] },
  { symbol: "TSM", names: ["TSMC", "Taiwan Semiconductor"] },
  { symbol: "ISRG", names: ["Intuitive Surgical"] },
  { symbol: "SYM", names: ["Symbotic"] },
  { symbol: "TER", names: ["Teradyne"] },
  { symbol: "ROK", names: ["Rockwell Automation"] },
  { symbol: "ZBRA", names: ["Zebra Technologies"] },
  { symbol: "CGNX", names: ["Cognex"] },
  { symbol: "PRCT", names: ["PROCEPT BioRobotics", "Procept BioRobotics"] },
  { symbol: "SERV", names: ["Serve Robotics"] },
  { symbol: "RR", names: ["Richtech Robotics"] },
  { symbol: "KSCP", names: ["Knightscope"] },
  { symbol: "FANUY", names: ["Fanuc", "FANUC"] },
  { symbol: "YASKY", names: ["Yaskawa"] },
  { symbol: "ABBNY", names: ["ABB Ltd"] },
];
