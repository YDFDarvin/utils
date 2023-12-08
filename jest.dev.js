const config = {...require("./jest.config.json")}

//@ts-expect-error
delete config.collectCoverageFrom

module.exports = config
