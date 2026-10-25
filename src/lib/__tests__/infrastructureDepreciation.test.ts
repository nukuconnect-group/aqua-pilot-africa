import { expect, it } from 'vitest';
import { validateInfrastructureDepreciation } from '../infrastructureDepreciation';
const input = {purchasePrice:100000,purchaseDate:'2026-10-24',usefulLife:5,currency:'XOF',method:'linear' as const};
it('accepts the real acquisition cost, date and lifespan for an infrastructure',()=>expect(validateInfrastructureDepreciation(input)).toBeNull());
it('requires a positive real cost',()=>expect(validateInfrastructureDepreciation({...input,purchasePrice:0})).not.toBeNull());
it('requires a service date',()=>expect(validateInfrastructureDepreciation({...input,purchaseDate:''})).not.toBeNull());
it('requires a valid number of years',()=>expect(validateInfrastructureDepreciation({...input,usefulLife:0})).not.toBeNull());