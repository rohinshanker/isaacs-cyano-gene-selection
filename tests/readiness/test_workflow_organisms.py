"""Every published organism receives CI gates for its source kind."""

import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


class WorkflowOrganismsTest(unittest.TestCase):
    """Keep design records in release gates without fetching them from NCBI."""

    def test_release_gates_cover_every_configured_organism(self):
        workflow = (ROOT / ".github/workflows/pages.yml").read_text()
        configured = json.loads((ROOT / "config/organisms.json").read_text())["organisms"]
        assembly_block = re.search(
            r"      ORGANISMS: >-\n((?:        [^\n]+\n)+)", workflow
        )
        design_block = re.search(r"      DESIGN_ORGANISMS: ([^\n]+)", workflow)
        self.assertIsNotNone(assembly_block)
        self.assertIsNotNone(design_block)
        assemblies = assembly_block.group(1).split()
        designs = design_block.group(1).split()
        self.assertEqual(len(assemblies + designs), len(set(assemblies + designs)))
        self.assertEqual(set(assemblies + designs), set(configured))
        self.assertTrue(all(configured[name]["ftpDirectory"] for name in assemblies))
        self.assertTrue(all(not configured[name]["ftpDirectory"] for name in designs))
        self.assertEqual(workflow.count("for organism in $ORGANISMS; do"), 1)
        self.assertEqual(
            workflow.count("for organism in $ORGANISMS $DESIGN_ORGANISMS; do"), 3
        )
        fetch_step = workflow.split("id: fetch_genomes", 1)[1].split("- name:", 1)[0]
        self.assertNotIn("$DESIGN_ORGANISMS", fetch_step)


if __name__ == "__main__":
    unittest.main()
