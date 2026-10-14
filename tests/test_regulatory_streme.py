"""Contracts and real bounded execution for the native STREME pilot."""
import argparse
from copy import deepcopy
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
SPEC = importlib.util.spec_from_file_location('streme', ROOT/'tools/regulatory_streme.py')
s = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(s)


def row(identifier, sequence='ACGTTGCA', start=1, locus=None, replicon='chr'):
    return dict(id=identifier, sequence=sequence, physicalSegments=[[start, start+len(sequence)-1]],
                sourceLocus=locus or identifier, replicon=replicon, strand='+', wrapsOrigin=False)


def pwm(consensus):
    return [[float(base == target) for base in s.BASES] for target in consensus]


def report(consensus='ACGT'):
    return 'MEME version 5.5.9\nALPHABET= ACGT\nMOTIF 1-test\nletter-probability matrix: alength= 4 w= '+str(len(consensus))+'\n'+'\n'.join(' '.join(map(str,r)) for r in pwm(consensus))+'\n'


@pytest.mark.parametrize('strand,position,width,sequence,segments,first,last', [
    ('+', 8, 4, 'TTGC', [[4,7]],4,7), ('-', 3, 4, 'GCAA', [[4,7]],7,4),
    ('+', 2, 4, 'CACA', [[10,12],[1,1]],10,1),
    ('-', 10, 4, 'GTGT', [[11,12],[1,2]],2,11),
])
def test_windows(strand,position,width,sequence,segments,first,last):
    result=s.upstream_window('ACGTTGCAACAC',position,strand,width)
    assert result == dict(sequence=sequence, physicalSegments=segments, wrapsOrigin=len(segments)>1,
                          orientedFirstBase=first, orientedLastBase=last)


@pytest.mark.parametrize('position,strand,width',[(0,'+',4),(13,'-',4),(4,'?',4),(4,'+',12),(4,'+',0)])
def test_window_invalid(position,strand,width):
    with pytest.raises(s.PilotError): s.upstream_window('ACGTTGCAACAC',position,strand,width)


def test_partition_transitive_overlap_locus_reverse_homology_and_origin():
    rows=independent_rows(100)
    rows[0]['physicalSegments']=[[1,4],[995,1000]]
    rows[1]['physicalSegments']=[[2,7]]
    rows[2]['sourceLocus']=rows[1]['sourceLocus']
    rows[3]['sequence']=s.rc(rows[2]['sequence'])
    result=s.blocked_partition(rows,2973,100,100,homology_word=30)
    assert len({r['partition'] for r in rows[:4]})==1
    assert len({r['group'] for r in rows[:4]})==1
    assert result['groups']<=97
    again=deepcopy(list(reversed(rows)))
    assert s.blocked_partition(again,2973,100,100,30)==result
    assert {r['id']:(r['group'],r['partition'],r['selected']) for r in rows} == {r['id']:(r['group'],r['partition'],r['selected']) for r in again}


def independent_rows(n=80):
    import random
    rng=random.Random(31)
    return [row(str(i), ''.join(rng.choice(s.BASES) for _ in range(40)),i*100) for i in range(n)]


def test_partition_caps_and_no_leakage():
    rows=independent_rows()
    result=s.blocked_partition(rows,7,25,10)
    assert result['selected']==dict(discovery=25,evaluation=10)
    for a in rows:
        for b in rows:
            if a['partition']!=b['partition']:
                assert a['sourceLocus']!=b['sourceLocus']
                assert not ({min(a['sequence'][i:i+30],s.rc(a['sequence'][i:i+30])) for i in range(11)} &
                            {min(b['sequence'][i:i+30],s.rc(b['sequence'][i:i+30])) for i in range(11)})


@pytest.mark.parametrize('rows,discovery,evaluation,word', [([],20,20,30),([row('a')],1,20,30),([row('a')],20,20,0),([row('a')],20,20,30)])
def test_partition_invalid(rows,discovery,evaluation,word):
    with pytest.raises(s.PilotError): s.blocked_partition(rows,7,discovery,evaluation,word)


@pytest.mark.parametrize('sequence',['ACGTTGCAACAC'*10,'A'*40,'ACGTACGTACGT','GTC'])
@pytest.mark.parametrize('seed',range(5))
def test_shuffle_preserves_linear_words_and_endpoints(sequence,seed):
    control=s.shuffle_order2(sequence,seed)
    assert len(control)==len(sequence)
    assert control[:2]==sequence[:2] and control[-2:]==sequence[-2:]
    assert all(s.word_counts(sequence,k)==s.word_counts(control,k) for k in (1,2,3))
    assert control==s.shuffle_order2(sequence,seed)


@pytest.mark.parametrize('sequence',['','AC','ACN'])
def test_shuffle_invalid(sequence):
    with pytest.raises(s.PilotError): s.shuffle_order2(sequence,1)


def test_parse_valid_empty_and_invalid():
    assert s.parse_pwms(report())[0]['consensus']=='ACGT'
    assert s.parse_pwms('MEME version 5.5.9\nALPHABET= ACGT\n')==[]
    for bad in ['','MEME version 5.5.8\nALPHABET= ACGT',report().replace('w= 4','w= 31'),
                report().replace('1.0','nan'),report().replace('1.0','2.0'),report().replace('1.0','bad'),
                report().replace('alength= 4','alength= 5'),report().rsplit('\n',3)[0],
                'MEME version 5.5.9\nALPHABET= ACGT\nMOTIF broken']:
        with pytest.raises(s.PilotError): s.parse_pwms(bad)


def test_scoring_reverse_offset_and_hand_calculated():
    motif=pwm('ACGTTA')
    hit=s.best_score('GG'+s.rc('ACGTTA')+'CC',motif,[.25]*4)
    assert hit['strand']=='-' and hit['offset0']==2
    assert hit['score']==pytest.approx(6*math.log2((1+1e-6)/(1+4e-6)/.25))
    assert s.ranking_evaluation([row('p','ACGTTA')],[row('n','CCCCCC')],[dict(id='m',pwm=motif)],[.25]*4)[0]['auc']==1
    assert s.ranking_evaluation([row('p','ACGTTA')],[row('n','ACGTTA')],[dict(id='m',pwm=motif)],[.25]*4)[0]['auc']==.5
    for sequence,bg in [('AC',[.25]*4),('ACGTNA',[.25]*4),('ACGTTA',[0,.5,.25,.25]),('ACGTTA',[.25])]:
        with pytest.raises(s.PilotError): s.best_score(sequence,motif,bg)


def test_recovery_shifted_reverse_full_and_partial():
    shifted=s.motif_recovery(pwm('CGTCGATC'))
    assert shifted['offset0']==1 and shifted['strand']=='+'
    assert shifted['consensusRecovery']==7/8 and shifted['plantedCoverage']==7/8
    assert shifted['probabilityRecovery']==7/8 and not shifted['exactFullConsensus']
    reverse=s.motif_recovery(pwm(s.rc('CGTCGATC')))
    assert reverse['strand']=='-' and reverse['offset0']==1 and reverse['consensusRecovery']==7/8
    assert s.motif_recovery(pwm(s.PLANT))['exactFullConsensus']
    assert s.motif_recovery(pwm('GTCG'))['consensusRecovery']==.5


def test_background_and_external_deterministic():
    assert s.background_frequencies([row('a','AAAA')])==[5/8,1/8,1/8,1/8]
    assert s.benchmark_external(7)==s.benchmark_external(7)
    pos,neg=s.benchmark_external(7)
    assert len(pos)==len(neg)==100
    assert {r['plantedStrand'] for r in pos}=={'+','-'}
    assert all(r['sequence'][45:53]==(s.PLANT if r['plantedStrand']=='+' else s.rc(s.PLANT)) for r in pos)


def test_execute_errors_and_streme_argv(monkeypatch,tmp_path):
    for error in [OSError('missing'),subprocess.TimeoutExpired('streme',1)]:
        def fail(*a,**k): raise error
        monkeypatch.setattr(s.subprocess,'run',fail)
        with pytest.raises(s.PilotError,match='execution failed'): s.execute(['streme'],1)
    monkeypatch.setattr(s.subprocess,'run',lambda *a,**k:argparse.Namespace(returncode=2,stderr='bad'))
    with pytest.raises(s.PilotError,match='exited 2'): s.execute(['streme'],1)
    monkeypatch.setattr(s.subprocess,'run',lambda *a,**k:argparse.Namespace(returncode=0,stderr='',stdout=report()))
    native=s.streme_run(Path('binary'),Path('p'),tmp_path/'r',7,10)
    assert '--n' not in native['argv'] and '--order' in native['argv']
    bench=s.streme_run(Path('binary'),Path('p'),tmp_path/'b',7,10,Path('n'),8)
    assert '--w' in bench['argv'] and '--n' in bench['argv']


def fake_inputs(monkeypatch,tmp_path):
    files={name:tmp_path/name for name in ['fasta','tss','binary','source_archive','benchmark_foreground','benchmark_control']}
    for path in files.values(): path.write_text('fixture')
    args=argparse.Namespace(**files,width=100,seed=2973,max_discovery=40,max_evaluation=20,timeout=10,output=tmp_path/'output')
    monkeypatch.setattr(s,'require_pin',lambda *a:None)
    monkeypatch.setattr(s,'native_cohort',lambda *a:independent_rows())
    monkeypatch.setattr(s,'load_fasta',lambda *a:dict(a='ACGT'*25))
    monkeypatch.setattr(s,'execute',lambda *a:argparse.Namespace(stdout='5.5.9'))
    monkeypatch.setattr(s,'streme_run',lambda *a,**k:dict(argv=['fake'],motifs=[dict(id='m',pwm=pwm('CGTCGATC'))]))
    return args


def test_transaction_success_no_reuse_and_evaluation_excluded(monkeypatch,tmp_path):
    args=fake_inputs(monkeypatch,tmp_path)
    calls=[]
    def run(binary,foreground,destination,*a,**kw):
        calls.append(foreground.name)
        destination.with_suffix('.txt').write_text(report('CGTCGATC'))
        return dict(argv=['fake'],motifs=[dict(id='m',pwm=pwm('CGTCGATC'))])
    monkeypatch.setattr(s,'streme_run',run)
    result=s.run_pilot(args)
    assert calls==['discovery.fasta','discovery.fasta','null-discovery.fasta','benchmark_foreground']
    assert result['partition']['selected']==dict(discovery=40,evaluation=15)
    assert result['benchmarkRecovery'][0]['consensusRecovery']==7/8
    manifest=json.loads((args.output/'manifest.json').read_text())
    assert all(s.sha256_file(args.output/name)==sha for name,sha in manifest.items())
    assert not list(tmp_path.glob('.streme-*'))
    with pytest.raises(s.PilotError,match='overwrite'):s.run_pilot(args)


@pytest.mark.parametrize('error',[s.PilotError('tool failure'),KeyboardInterrupt(),OSError('disk full')])
def test_transaction_failure_removes_owned_output(monkeypatch,tmp_path,error):
    args=fake_inputs(monkeypatch,tmp_path)
    def fail(*a,**kw): raise error
    monkeypatch.setattr(s,'streme_run',fail)
    with pytest.raises(type(error)):s.run_pilot(args)
    assert not args.output.exists() and not list(tmp_path.glob('.streme-*'))
    assert args.fasta.exists()


def test_transaction_repeat_mismatch_and_version(monkeypatch,tmp_path):
    args=fake_inputs(monkeypatch,tmp_path)
    monkeypatch.setattr(s,'execute',lambda *a:argparse.Namespace(stdout='5.0'))
    with pytest.raises(s.PilotError,match='version'):s.run_pilot(args)
    monkeypatch.setattr(s,'execute',lambda *a:argparse.Namespace(stdout='5.5.9'))
    calls=iter(['ACGT','TGCA'])
    monkeypatch.setattr(s,'streme_run',lambda *a,**kw:dict(motifs=[dict(pwm=pwm(next(calls)))]))
    with pytest.raises(s.PilotError,match='deterministic'):s.run_pilot(args)
    assert not list(tmp_path.glob('.streme-*'))


def test_transaction_publication_failure_and_cleanup_denial(monkeypatch,tmp_path):
    args=fake_inputs(monkeypatch,tmp_path)
    original=Path.rename
    def fail(self,target):
        if self.name=='result.json': raise OSError('publish error')
        return original(self,target)
    monkeypatch.setattr(Path,'rename',fail)
    with pytest.raises(OSError,match='publish'):s.run_pilot(args)
    assert not args.output.exists() and not list(tmp_path.glob('.streme-*'))
    monkeypatch.setattr(s.shutil,'rmtree',lambda *a: (_ for _ in ()).throw(OSError('denied')))
    with pytest.raises(s.PilotError,match='publish error; cleanup failed'):s.run_pilot(args)


@pytest.mark.parametrize('field,value',[('width',20),('timeout',0),('seed',-1)])
def test_pilot_bounds(monkeypatch,tmp_path,field,value):
    args=fake_inputs(monkeypatch,tmp_path);setattr(args,field,value)
    with pytest.raises(s.PilotError,match='required'):s.run_pilot(args)


def test_pin_rejects_mismatch(tmp_path):
    p=tmp_path/'x';p.write_text('x')
    s.require_pin(p,s.sha256_file(p))
    with pytest.raises(s.PilotError,match='SHA-256'):s.require_pin(p,'bad')


@pytest.mark.skipif(not os.environ.get('STREME_REAL_ROOT'),reason='opt-in pinned real pilot')
def test_real_native_execution(tmp_path):
    root=Path(os.environ['STREME_REAL_ROOT'])
    canonical=Path(os.environ['STREME_NATIVE_ROOT'])
    args=argparse.Namespace(fasta=canonical/'data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz',
        tss=ROOT/'data/expression/tan2018_utex2973_tss_table_s1.tsv',binary=root/'meme-5.5.9/src/streme',
        source_archive=root/'meme-5.5.9.tar.gz',benchmark_foreground=ROOT/'tests/fixtures/regulatory-streme/foreground.fasta',
        benchmark_control=ROOT/'tests/fixtures/regulatory-streme/background.fasta',output=tmp_path/'real',width=100,seed=2973,
        max_discovery=100,max_evaluation=50,timeout=120)
    result=s.run_pilot(args)
    assert result['coverage']['anchors']==2475 and result['repeatPwmIdentical']
    assert result['benchmarkRecovery'][0]['consensusRecovery']==7/8
    assert not result['benchmarkRecovery'][0]['exactFullConsensus']
    assert result['benchmarkExternal'][0]['alignmentOffsetAndStrandConsistent']>=90


def test_native_cohort_pin_count_structure_and_window_validation(monkeypatch,tmp_path):
    import csv
    fasta=tmp_path/'fasta';fasta.write_text('fixture')
    tss=tmp_path/'tss'
    monkeypatch.setattr(s,'require_pin',lambda *a:None)
    monkeypatch.setattr(s,'EXPECTED_REPLICON_LENGTHS',{'NZ_CP006471.1':3000})
    monkeypatch.setattr(s,'load_fasta',lambda *a:{'NZ_CP006471.1':'ACGT'*750})
    fields=['tss_id','replicon','position','strand','type','locus_tag']
    rows=[dict(tss_id=f'gTSS+{i+1}',replicon='CP006471',position=i+1,strand='+',type='gTSS',locus_tag=f'L{i}') for i in range(2475)]
    def write(records):
        with tss.open('w') as h:
            w=csv.DictWriter(h,fieldnames=fields,delimiter='\t');w.writeheader();w.writerows(records)
    write(rows)
    result=s.native_cohort(fasta,tss,30)
    assert len(result)==2475 and any(r['wrapsOrigin'] for r in result)
    write(rows[:2])
    with pytest.raises(s.PilotError,match='2475'):s.native_cohort(fasta,tss,30)
    for field,value in [('tss_id','bad'),('replicon','unknown'),('locus_tag',''),('type','aTSS'),('strand','?')]:
        altered=deepcopy(rows);altered[0][field]=value;write(altered)
        with pytest.raises(s.PilotError):s.native_cohort(fasta,tss,30)
    altered=deepcopy(rows);altered[1]=altered[0];write(altered)
    with pytest.raises(s.PilotError,match='duplicate'):s.native_cohort(fasta,tss,30)
    write(rows)
    monkeypatch.setattr(s,'EXPECTED_REPLICON_LENGTHS',{'NZ_CP006471.1':4})
    with pytest.raises(s.PilotError,match='lengths'):s.native_cohort(fasta,tss,30)


def test_publication_race_preserves_existing_destination(monkeypatch,tmp_path):
    args=fake_inputs(monkeypatch,tmp_path)
    original=Path.mkdir
    def race(self,*a,**kw):
        if self==args.output:
            original(self)
            (self/'owner').write_text('foreign')
        return original(self,*a,**kw)
    monkeypatch.setattr(Path,'mkdir',race)
    with pytest.raises(FileExistsError):s.run_pilot(args)
    assert (args.output/'owner').read_text()=='foreign'
    assert not list(tmp_path.glob('.streme-*'))


def test_output_symlink_rejected_and_empty_null_accepted(monkeypatch,tmp_path):
    args=fake_inputs(monkeypatch,tmp_path)
    args.output.symlink_to(tmp_path/'missing')
    with pytest.raises(s.PilotError,match='overwrite'):s.run_pilot(args)
    args.output.unlink()
    monkeypatch.setattr(s,'streme_run',lambda *a,**kw:dict(argv=['fake'],motifs=[]))
    result=s.run_pilot(args)
    assert result['external']==result['nullExternal']==result['benchmarkRecovery']==[]


def test_partial_write_failure_and_interrupt_clean_staging(monkeypatch,tmp_path):
    args=fake_inputs(monkeypatch,tmp_path)
    original=Path.write_bytes
    def fail(self,value):
        if self.name=='evaluation.fasta':
            original(self,value[:8]);raise OSError('write failed')
        return original(self,value)
    monkeypatch.setattr(Path,'write_bytes',fail)
    with pytest.raises(OSError,match='write failed'):s.run_pilot(args)
    assert not args.output.exists() and not list(tmp_path.glob('.streme-*'))


def test_shuffle_asserts_own_contract(monkeypatch):
    iterator=iter([{'a':1},{'a':2}])
    monkeypatch.setattr(s,'word_counts',lambda *a:next(iterator))
    with pytest.raises(s.PilotError,match='preservation'):s.shuffle_order2('ACGTACGT',1)


def test_cli_help_and_failure():
    script=ROOT/'tools/regulatory_streme.py'
    assert subprocess.run([sys.executable,str(script),'--help'],capture_output=True).returncode==0
    command=[sys.executable,str(script)]
    for flag in ['fasta','tss','binary','source-archive','benchmark-foreground','benchmark-control','output']:
        command+=['--'+flag,'missing']
    result=subprocess.run(command,capture_output=True,text=True)
    assert result.returncode==1 and 'STREME pilot:' in result.stderr


def test_aligned_identity_blocks_mutated_homology_without_exact_word():
    rows=independent_rows(100)
    original=rows[0]['sequence']
    altered=''.join(s.BASES[(s.BASES.index(base)+1)%4] if i%5==0 else base for i,base in enumerate(original))
    rows[1]['sequence']=altered
    rows[2]['sequence']=s.rc(altered)
    assert all(original[i:i+30] not in altered and s.rc(original[i:i+30]) not in altered for i in range(11))
    s.blocked_partition(rows,7,80,30)
    assert rows[0]['group']==rows[1]['group']==rows[2]['group']
    # A different length doesn't enter the ungapped global-identity comparison.
    rows[-1]['sequence']='A'*39
    s.blocked_partition(rows,7,80,30)


def test_durable_historical_fixture_pins_and_planted_offsets():
    root=ROOT/'tests/fixtures/regulatory-streme'
    for name,expected in zip(['foreground.fasta','background.fasta'],s.BENCHMARK_SHA256):
        s.require_pin(root/name,expected)
        sequences=s.load_fasta(root/name)
        assert len(sequences)==100 and all(len(value)==100 for value in sequences.values())
    assert all(s.PLANT in sequence for sequence in s.load_fasta(root/'foreground.fasta').values())
