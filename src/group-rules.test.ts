import {
  createRuleValidator,
  RuleSchema,
  validateRules,
  type Rule
} from "./group-rules";
import { sourcesMock } from "./group-rules.json";
import type { Dict } from "./ts-utils.types";

describe(validateRules.name,  () => {
  const sources = sourcesMock.sources
  , ruleName = "rules"

  describe("Received", () => {
    const rules = {
      [ruleName]: {
        "groupBy": [],
        "logical": "$allOf",
        "triggers": [{
          "logical": "$allOf",
          "filter": [],
          "aggregate": [{
            "prop": "" as any,
            "agg": "$count",
            "conditions": [{
              "op": "$gt",
              "value": 0
            }]
          }]
        }]
      }
    }  satisfies Record<string, Rule<typeof sources[number]>> satisfies Dict<RuleSchema>

    it("[]", async () => expect(await validateRules(
      [] as typeof sources
    , rules)).toStrictEqual({[ruleName]: {
      "is": false,
      "triggers": [{
        "is": false
      }]
    }}))

    it("sources", async () => expect(await validateRules(
      sources
    , rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "": 1
      }]
    }}))
  })

  describe("Received from score > 40 and sources > 5%", () => {
    const rules = {
      [ruleName]: {
        "groupBy": [],
        "logical": "$allOf",
        "triggers": [{
          "logical": "$allOf",
          "filter": [{
            "prop": "funds.score",
            "conditions": [{
              "op": "$gt",
              "value": 40
            }]
          }],
          "aggregate": [{
            "prop": "share",
            "agg": "$sum",
            "conditions": [{
              "op": "$gt",
              "value": 0.05
            }]
          }]
        }]
      }
    } satisfies Record<string, Rule<typeof sources[number]>> satisfies Dict<RuleSchema>;

    it("item", async () => expect(await validateRules([
      {"funds": {"score": 44}, "share": 0.04}
    ], rules)).toStrictEqual({[ruleName]: {
      "is": false,
      "triggers": [{
        "is": false,
        "share": 0.04
      }]
    }}))

    it("sources", async () => expect(await validateRules(
      sources
    , rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "share": 0.14699180203099999
      }]
    }}))
  });

  describe("Received from type in (Known sources, type2, type3)", () => {
    const rules = {
      [ruleName]: {
        "groupBy": [],
        "logical": "$allOf",
        "triggers": [{
          "logical": "$allOf",
          "filter": [{
            "prop": "listType",
            "conditions": [{
              "op": "$in",
              "value": ["Known sources", "type2", "type3"]
            }]
          }],

          "aggregate": [{
            "prop": "listType",
            "agg": "$count",
            "as": "count",
            "conditions": [{
              "op": "$gt",
              "value": 0
            }]
          }, {
            "prop": "listType",
            "agg": "$last",
          }]
        }]
      }
    } satisfies Record<string, Rule<typeof sources[number]>> satisfies Dict<RuleSchema>

    it("type1", async () => expect(await validateRules([
      {"listType": "type1"}
    ], rules)).toStrictEqual({[ruleName]: {
      "is": false,
      "triggers": [{"is": false}]
    }}))

    it("type2", async () => expect(await validateRules([
      {"listType": "type2"}
    ], rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "count": 1,
        "listType": "type2"
      }]
    }}))


    it("type1 & type3", async () => expect(await validateRules([
      {"listType": "type1"},
      {"listType": "type3"}
    ], rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "count": 1,
        "listType": "type3"
      }]
    }}))

    it("sources", async () => expect(await validateRules(
      sources
    , rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "count": 1,
        "listType": "Known sources"
      }]
    }}))
  });

  describe("Received from owner = Kucoin.com and sources > 0.05%", () => {
    const rules = {
      [ruleName]: {
        "groupBy": [],
        "logical": "$allOf",
        "triggers": [{
          "logical": "$allOf",
          "filter": [{
            "prop": "owner",
            "conditions": [{
              "op": "$eq",
              "value": "Kucoin.com"
            }]
          }],
          "aggregate": [
            {
              "prop": "amount",
              "agg": "$sum",
              "as": "total",
              "filter": false,
            },
            {
              "prop": "amount",
              "agg": "$sum",
            },
            {
              "prop": "share",
              "agg": "$sum",
              "expr": {
                "op": "$divide",
                "args": ["amount", "total"]
              },
              "conditions": [{
                "op": "$gt",
                "value": 0.0005
              }, {
                "op": "$lt",
                "value": 0.0006
              }]
            }
          ]
        }]
      }
    }  satisfies Record<string, Rule<typeof sources[number]>> satisfies Dict<RuleSchema>

    it("Binance", async () => expect(await validateRules([
      {"owner": "Binance", "share": 0} as typeof sources[number]
    ], rules)).toStrictEqual({[ruleName]: {
      "is": false,
      "triggers": [{
        "is": false,
        "total": undefined,
        "amount": undefined,
        "share": undefined
      }]
    }}))

    it("Kucoin.com (without share mess)", async () => expect(await validateRules([
      {"owner": "Kucoin.com", "amount": 5.5},
      {"onwer": "other", "amount": 10000 - 5.5}
    ] as typeof sources, rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "total": 10000,
        "amount": 5.5,
        "share": 0.00055
      }]
    }}))

    it("Kucoin.com (share mess is ignored)", async () => expect(await validateRules([
      {"owner": "Kucoin.com", "amount": 5.5, "share": 0.9},
      {"onwer": "other", "amount": 10000 - 5.5, "share": 0.1}
    ] as typeof sources, rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "total": 10000,
        "amount": 5.5,
        "share": 0.00055
      }]
    }}))

    it("sources", async () => expect(await validateRules(
      sources
    , rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "total": 105841549,
        "amount": 56590,
        "share": 0.0005346671560900909,
      }]
    }}))
  });

  describe("Received more than 50000000 and (owner = Binance and source > 50%)", () => {
    const rules = {
      [ruleName]: {
        "groupBy": [],
        "logical": "$allOf",
        "triggers": [{
          "logical": "$allOf",
          "filter": [],
          "aggregate": [{
            "prop": "amount",
            "agg": "$sum",
            "conditions": [{
              "op": "$gt",
              "value": 50000000
            }],
          }]
        }, {
          "logical": "$allOf",
          "filter": [{
            "prop": "owner",
            "conditions": [{
              "op": "$in",
              "value": ["Binance", "Binance Hot Wallet"]
            }]
          }],
          "aggregate": [{
            "agg": "$sum",
            "prop": "share",
            "conditions": [{
              "op": "$gt",
              "value": 0.5
            }]
          }]
        }]
      }
    } satisfies Record<string, Rule<typeof sources[number]>> satisfies Dict<RuleSchema>

    it("Both", async () => expect(await validateRules([
      {"owner": "Binance", "amount": 25000000, "share": 0.25},
      {"owner": "Kucoin", "amount": 10000000, "share": 0.10},
      {"owner": "Binance", "amount": 25000000, "share": 0.25},
      {"owner": "Kucoin", "amount": 10000000, "share": 0.10},
      {"owner": "Binance", "amount": 1, "share": 0.01}
    ], rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "amount": 70000001
      }, {
        "is": true,
        "share": 0.51
      }]
    }}))

    it("amount#1", async () => expect(await validateRules([
      {"owner": "Binance", "amount": 25000000, "share": 0.25},
      {"owner": "Binance", "amount": 10000000, "share": 0.1},
      {"owner": "Kucoin", "amount": 25000000, "share": 0.25},
      {"owner": "Kucoin", "amount": 10000000, "share": 0.1},
      {"owner": "Kucoin", "amount": 30000000, "share": 0.3},
    ], rules)).toStrictEqual({[ruleName]: {
      "is": false,
      "triggers": [{
        "is": true,
        "amount": 100000000,
      }, {
        "is": false,
        "share": 0.35
      }]
    }}))

    it("amount#2", async () => expect(await validateRules([
      {"owner": "Binance", "amount": 50000000, "share": 0.5},
      {"owner": "Kucoin", "amount": 25000000, "share": 0.25},
      {"owner": "Bitget", "amount": 25000000, "share": 0.25},
    ], rules)).toStrictEqual({[ruleName]: {
      "is": false,
      "triggers": [{
        "is": true,
        "amount": 100000000,
      }, {
        "is": false,
        "share": 0.5
      }]
    }}))

    it("sources", async () => expect(await validateRules(
      sources
    , rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "amount": 105841549,
      }, {
        "is": true,
        "share": 0.994678896024,
      }]
    }}))
  });

  describe("Received more than 5% from (Darknet || Darkweb) or more than 5% from Score >= 50", () => {
    const rules = {
      [ruleName]: {
        "groupBy": [],
        "logical": "$anyOf",
        "triggers": [{
          "logical": "$anyOf",
          "filter": [{
            "prop": "funds.name",
            "conditions": [{
              "op": "$in",
              "value": ["Darknet", "Darkweb"]
            }]
          }],

          "aggregate": [{
            "prop": "share",
            "agg": "$sum",
            "conditions": [
              {
                "op": "$gte",
                "value": 0.05
              }, {
                "op": "$lt",
                "value": 1
              }
            ]
          }, {
            "prop": "funds.name",
            "agg": "$first"
          }],
        },
        {
          "logical": "$anyOf",
          "filter": [{
            "prop": "funds.score",
            "conditions": [{
              "op": "$gte",
              "value": 50
            }]
          }],

          "aggregate": [{
            "prop": "share",
            "agg": "$sum",

            "conditions": [{
              "op": "$gte",
              "value": 0.05
            }]
          }, {
            "prop": "funds.score",
            "agg": "$max",
          }]
        }]
      }
    }  satisfies Record<string, Rule<typeof sources[number]>> satisfies Dict<RuleSchema>

    it("Darknet", async () => expect(await validateRules([
      {"funds": {"name": "Darknet", "score": 0}, "share": 0.01, "amount": 1},
      {"funds": {"name": "Clear net", "score": 0}, "share": 0.90, "amount": 90},
      {"funds": {"name": "Clear net", "score": 0}, "share": 0.04, "amount": 4},
      {"funds": {"name": "Darknet", "score": 0}, "share": 0.05, "amount": 5},
    ], rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "funds.name": "Darknet",
        "share": 0.060000000000000005,          
      }, {
        "is": false
      }],
    }}))

    it("Darkweb", async () => expect(await validateRules([
      {"funds": {"name": "Darkweb", "score": 0}, "share": 0.01, "amount": 1},
      {"funds": {"name": "Darkweb", "score": 0}, "share": 0.05, "amount": 5},
      {"funds": {"name": "Clear net", "score": 0}, "share": 0.94, "amount": 94},
    ], rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "funds.name": "Darkweb",
        "share": 0.060000000000000005,          
      }, {
        "is": false
      }],
    }}))

    it("Both", async () => expect(await validateRules([
      {"funds": {"name": "Darknet", "score": 0}, "share": 0.01, "amount": 1},
      {"funds": {"name": "Clear net", "score": 0}, "share": 0.08, "amount": 8},
      {"funds": {"name": "Clear net", "score": 55}, "share": 0.89, "amount": 89},
      {"funds": {"name": "Clear net", "score": 60}, "share": 0.01, "amount": 1},
      {"funds": {"name": "Darknet", "score": 0}, "share": 0.01, "amount": 1},
    ], rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": false,
        "funds.name": "Darknet",
        "share": 0.02,          
      }, {
        "is": true,
        "funds.score": 60,
        "share": 0.9
      }]
    }}))

    it("Nothing", async () => expect(await validateRules([
      {"funds": {"name": "Darknet", "score": 0}, "share": 0.01, "amount": 1},
      {"funds": {"name": "Clear net", "score": 0}, "share": 0.98, "amount": 98},
      {"funds": {"name": "Darknet", "score": 0}, "share": 0.01, "amount": 1},
    ], rules)).toStrictEqual({[ruleName]: {
      "is": false,
      "triggers": [{
        "is": false,
        "funds.name": "Darknet",
        "share": 0.02
      }, {
        "is": false
      }]
    }}))

    it("sources", async () => expect(await validateRules(
      sources
    , rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": false,
      }, {
        "is": true,
        "funds.score": 50,
        "share": 0.14699180203099999,
      }]
    }}))
  });

  describe("Max share > 0.3 && sum > 0.5 && count > 1", () => {
    const rules = {
      [ruleName]: {
        "groupBy": ["owner", "address"],
        "logical": "$allOf",
        "triggers": [{
          "logical": "$allOf",
          "filter": [],

          "aggregate": [{
            "prop": "share",
            "agg": "$sum",
            "conditions": [{
              "op": "$gt",
              "value": 0.5
            }]
          }],
        }, {
          "logical": "$allOf",
          "filter": [],
          "aggregate": [{
            "prop": "share",
            "agg": "$max",
            "conditions": [{
              "op": "$gt",
              "value": 0.3
            }]
          }]
        }, {
          "logical": "$allOf",
          "filter": [],
          "aggregate": [{
            "prop": "" as any,
            "agg": "$count",
            "conditions": [{
              "op": "$gt",
              "value": 1
            }]
          }]
        }]
      }
    }  satisfies Record<string, Rule<typeof sources[number]>> satisfies Dict<RuleSchema>


    it("sources", async () => expect(await validateRules(
      sources
    , rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "share": 0.994678896024,
      }, {
        "is": true,
        "share": 0.362496644715,
      }, {
        "is": true,
        "": 1
      }],
    }}))
  });

  describe("Received from owner1 > 100000 && share > 0.3 && share <= 0.6", () => {
    const rules = {
      [ruleName]: {
        "groupBy": [],
        "logical": "$allOf",
        "triggers": [{
          "logical": "$allOf",
          "filter": [{
            "prop": "owner",
            "conditions": [{
              "op": "$eq",
              "value": "owner1"
            }]
          }],
          "aggregate": [{
            "prop": "share",
            "agg": "$sum",
            "conditions": [{
              "op": "$gt",
              "value": 0.3
            }, {
              "op": "$lte",
              "value": 0.6
            }]
          }]
        }, {
          "logical": "$allOf",
          "filter": [{
            "prop": "owner",
            "conditions": [{
              "op": "$eq",
              "value": "owner1"
            }]
          }],

          "aggregate": [{
            "prop": "amount",
            "agg": "$sum",
            "conditions": [{
              "op": "$gt",
              "value": 100000
            }]
          }]
        }]
      }
    }  satisfies Record<string, Rule<typeof sources[number]>> satisfies Dict<RuleSchema>

    it("Both", async () => expect(await validateRules([
      {"owner": "owner1", "share": 0.1, "amount": 100000},
      {"owner": "owner1", "share": 0.1, "amount": 100000},
      {"owner": "owner1", "share": 0.2, "amount": 200000},
      {"owner": "owner2", "share": 0.2, "amount": 200000},
      {"owner": "owner3", "share": 0.2, "amount": 200000},
      {"owner": "owner4", "share": 0.2, "amount": 200000},
    ], rules)).toStrictEqual({[ruleName]: {
      "is": true,
      "triggers": [{
        "is": true,
        "share": 0.4
      }, {
        "is": true,
        "amount": 400000
      }],
    }}))

    it("Nothing", async () => expect(await validateRules([
      {"owner": "owner1", "share": 0.2, "amount": 20000},
      {"owner": "owner1", "share": 0.2, "amount": 20000},
      {"owner": "owner1", "share": 0.2, "amount": 20000},
      {"owner": "owner2", "share": 0.4, "amount": 40000},
    ], rules)).toStrictEqual({[ruleName]: {
      "is": false,
      "triggers": [{
        "is": false,
        "share": 0.6000000000000001,
      }, {
        "is": false,
        "amount": 60000,
      }]
    }}))

    it("sources", async () => expect(await validateRules(
      sources
    , rules)).toStrictEqual({[ruleName]: {
      "is": false,
      "triggers": [{
        "is": false,
      }, {
        "is": false,
      }]
    }}))
  });

  it("$max stuff", async () => {
    const result = await validateRules(
      [{
        "id": "a",
        "value": 1
      }, {
        "id": "a",
        "value": 3
      }, {
        "id": "a",
        "value": 2
      }, {
        "id": "a",
        "value": undefined
      }, {
        "id": "a",
        "value": null
      }],
      {
        "rule": {
          "groupBy": ["id"],
          "logical": "$allOf",
          "triggers": [{
            "logical": "$anyOf",
            "filter": [],
            "aggregate": [{
              "prop": "value",
              "agg": "$max",
              "conditions": [],
            }]
          }]
        }
      }
    )

    expect(result).toStrictEqual({
      "rule": {
        "is": false,
        "triggers": [{
          "is": false,
          "value": 3
        }]
      },
    })
  })

  it("$last stuff", async () => {
    const result = await validateRules(
      [{
        "id": "a",
        "value": undefined
      }, {
        "id": "a",
        "value": "b"
      }, {
        "id": "a",
        "value": "c"
      }, {
        "id": "a",
        "value": undefined
      }],
      {
        "rule": {
          "groupBy": ["id"],
          "logical": "$allOf",
          "triggers": [{
            "logical": "$anyOf",
            "filter": [],
            "aggregate": [{
              "prop": "value",
              "agg": "$last",
              "conditions": [],
            }]
          }]
        }
      }
    )

    expect(result).toStrictEqual({
      "rule": {
        "is": false,
        "triggers": [{
          "is": false,
          "value": "c"
        }]
      },
    })
  })
});

describe(createRuleValidator.name, () => {
  it("on empty", () => {
    const validator = createRuleValidator({})

    validator.push({})
    validator.push([])

    expect(
      validator.validateRules()
    ).toBe(
      undefined
    )
  })

  it("several", () => {
    type Item = {"id": string, "amount": number}
    const rules = {
      "r1": {
        "groupBy": ["id"],
        "logical": "$anyOf",
        "triggers": [{
          "logical": "$allOf",
          "filter": [{
            "prop": "amount",
            "conditions": [{
              "op": "$gte",
              "value": 1
            }, {
              "op": "$lte",
              "value": 2
            }]
          }],
          "aggregate": [{
            "prop": "amount",
            "agg": "$sum",
            "conditions": [{
              "op": "$gte",
              "value": 4
            }]
          }]
        }, {
          "logical": "$anyOf",
          "filter": [],
          "aggregate": [{
            "agg": "$max",
            "prop": "amount",
          }]
        }]
      }
    } satisfies {[k in string]: Rule<Item>}
    , validator = createRuleValidator<Item, string>(rules)

    validator.push({"id": "i1", "amount": 0.5})
    validator.push({"id": "i1", "amount": 0.5})

    validator.push({"id": "i2", "amount": 0.5})
    validator.push({"id": "i2", "amount": 1.51})
    validator.push({"id": "i2", "amount": 1.901})

    validator.push({"id": "i3", "amount": 0.5})
    validator.push({"id": "i3", "amount": 1.0001})
    validator.push({"id": "i3", "amount": 1.50001})
    validator.push({"id": "i3", "amount": 2.5})

    validator.push({"id": "i4", "amount": 5})
    validator.push({"id": "i4", "amount": 5})

    expect(validator.validateRules()).toStrictEqual({"r1": {
      "is": false,
      "triggers": [{
        "is": false,
        "amount": 5.911110000000001,
      }, {
        "is": false,
        "amount": 5
      }]
    }})
  })

  it("top aggregation allOf", () => {
    type Item = {"id": string, "owner": string}
    const rules = {
      "r1": {
        "groupBy": ["id"],
        "logical": "$allOf",
        "triggers": [{
          "logical": "$allOf",
          "filter": [{
            "prop": "owner",
            "conditions": [{
              "op": "$in",
              "value": ["owner0", "owner1"]
            }]
          }],
          "aggregate": [{
            "prop": "id",
            "agg": "$count",
            "as": "count2"
          }]
        }, {
          "logical": "$allOf",
          "filter": [{
            "prop": "owner",
            "conditions": [{
              "op": "$in",
              "value": ["owner0", "owner2"]
            }]
          }],
          "aggregate": [{
            "prop": "id",
            "agg": "$count",
            "as": "count1"
          },]
        }],
        "aggregate": [{
          "prop": "id",
          "as": "count",
          "agg": "$count",        
        }]
      },
    } satisfies {[k in string]: Rule<Item>} satisfies Dict<RuleSchema>
    , validator = createRuleValidator<Item, string>(rules)

    validator.push({"id": "i", "owner": ""})
    validator.push({"id": "i0", "owner": "owner0"})
    validator.push({"id": "i1", "owner": "owner1"})
    validator.push({"id": "i2", "owner": "owner2"})

    expect(validator.validateRules()).toStrictEqual({
      "r1": {
        "is": false,
        "count": 3,
        "triggers": [
          {
            "count2": 2,
            "is": false
          },
          {
            "count1": 2,
            "is": false
          }
        ]
      }
    })
  })
})
