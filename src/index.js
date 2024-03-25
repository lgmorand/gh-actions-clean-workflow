import { setFailed } from "@actions/core";
import { dateDiff, calcTimeUnits } from "./utils/date.js";
import { getToken, getOwner, getRepo, getRunsToKeep, getDaysOld } from "./helpers/params.js";
import { getApi } from "./helpers/api.js";

async function run() {
  try {
    const token = getToken("token");
    const owner = getOwner("owner");
    const repo = getRepo("repo");
    const numRunsToKeep = getRunsToKeep("runs_to_keep");
    const numDaysOldToBeDeleted = getDaysOld("days_old");

    const api = getApi({ token, owner, repo });

    const hasRunBeforeDate = (run) => {
      const diff = dateDiff(run.updated_at, Date.now());
      return calcTimeUnits(diff).days >= numDaysOldToBeDeleted;
    };

    // get all workflows
    const workflowRuns = await api.listWorkflowRuns().filter(hasRunBeforeDate);

    // object to store workflows by path
    let workflowsByPath = {};

    // Sort and group workflows by path
    workflowRuns.forEach(workflow => {
      if (!workflowsByPath[workflow.path]) {
        workflowsByPath[workflow.path] = [];
      }
      workflowsByPath[workflow.path].push(workflow);
    });

    // only keeps the X last
    for (let path in workflowsByPath) {
      workflowsByPath[path] = workflowsByPath[path].filter(hasRunBeforeDate).slice(-numRunsToKeep);
    }

    
    const workflowRunsToDelete = workflowRuns.filter(hasRunBeforeDate).slice(numRunsToKeep);

    console.info("%d workflow runs to be deleted", workflowRunsToDelete.length);

    if (workflowRunsToDelete.length > 0) {
      const results = await api.deleteRuns(workflowRunsToDelete);

      if (results.length > 0) {
        console.info("%d workflow runs sucessfully deleted", results.length);
      } else {
        throw new Error(
          `The action could not delete any workflows. Please review your parameters.`
        );
      }
    }
  } catch (err) {
    console.error(err);
    setFailed(err.message);
  }
}

run();
