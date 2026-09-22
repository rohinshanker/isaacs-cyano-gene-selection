/* Narrow ViennaRNA 2.7.2 ABI: unconstrained linear RNA MFE at 37 C. */
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <ViennaRNA/fold_compound.h>
#include <ViennaRNA/mfe.h>
#include <ViennaRNA/model.h>
#include <ViennaRNA/params/io.h>

static char last_structure[101];

float fold_mfe(const char *sequence) {
  size_t length = strlen(sequence);
  if (!length || length > 100 || strspn(sequence, "ACGU") != length) return NAN;
  vrna_md_t model;
  vrna_md_set_default(&model);
  model.temperature = 37.0;
  model.dangles = 2;
  model.noLP = 0;
  model.noGU = 0;
  model.noGUclosure = 0;
  model.circ = 0;
  model.gquad = 0;
  model.uniq_ML = 0;
  model.min_loop_size = 3;
  vrna_params_load_RNA_Turner2004();
  vrna_fold_compound_t *compound = vrna_fold_compound(sequence, &model, VRNA_OPTION_MFE);
  if (!compound) return NAN;
  float energy = vrna_mfe(compound, last_structure);
  vrna_fold_compound_free(compound);
  return energy;
}

const char *fold_structure(void) {
  return last_structure;
}
