module.exports = ({ i }) => i.editReply(require("../../ranking-pages").payload());
module.exports.metadata = {
  "name": "ranking",
  "scope": "staff",
  "schema": {
    "options": [],
    "name": "ranking",
    "description": "Ranking de actividad real de staff",
    "dm_permission": false,
    "type": 1
  }
};
