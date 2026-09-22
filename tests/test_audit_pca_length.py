"""Checks for the reproducible native PCA length audit conventions."""

import numpy as np

from scripts import feature_metrics as fm
from tools.audit_pca_length import rscu_for_codons, translated_packed_codons


def test_resampled_rscu_uses_the_pipeline_convention():
    codons = ["ATG", "GCT", "GCC", "GCC", "TTC"]
    expected = fm.rscu("".join(codons) + "TAA")
    np.testing.assert_allclose(rscu_for_codons(codons), expected)
    assert np.count_nonzero(rscu_for_codons(codons) == 0) > 0


def test_packed_alternative_start_is_translated_as_methionine():
    packed = fm.pack_codons("GTGGCTTAA")
    assert translated_packed_codons(packed) == ["ATG", "GCT"]
