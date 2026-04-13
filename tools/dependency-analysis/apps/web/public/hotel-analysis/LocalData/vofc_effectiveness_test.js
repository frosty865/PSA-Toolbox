/**
 * VOFC Effectiveness Testing Framework
 * Tests the new refactored system's effectiveness without requiring the old system
 */

class VOFCEffectivenessTest {
    constructor() {
        this.testResults = {
            performance: {},
            accuracy: {},
            reliability: {},
            functionality: {},
            overall: {}
        };
        this.testData = this.generateTestData();
    }
    
    /**
     * Generate comprehensive test data
     */
    generateTestData() {
        return {
            // Test Case 1: No Security Measures
            noSecurity: {
                has_perimeter_barriers: 'No',
                vss_present: 'No',
                secforce_247: 'No',
                els_present: 'No',
                soc_present: 'No'
            },
            
            // Test Case 2: Partial Security
            partialSecurity: {
                has_perimeter_barriers: 'Yes',
                standoff_perimeter_fencing: 'Chain Link',
                vss_present: 'Yes',
                vss_coverage: 'Partial',
                secforce_247: 'Yes',
                secforce_armed: 'No',
                els_present: 'No'
            },
            
            // Test Case 3: Good Security
            goodSecurity: {
                has_perimeter_barriers: 'Yes',
                standoff_perimeter_fencing: 'Security Rated',
                standoff_fence_height: 8,
                vss_present: 'Yes',
                vss_coverage: 'Full',
                secforce_247: 'Yes',
                secforce_armed: 'Yes',
                els_present: 'Yes',
                soc_present: 'Yes'
            },
            
            // Test Case 4: VIP Security Focus
            vipSecurity: {
                vip_areas_present: 'Yes',
                vip_room_count: 10,
                vip_access_control: 'Yes',
                vip_screening: 'Yes',
                vip_security_staff: 'Yes',
                vip_escort_service: 'Yes',
                vip_parking: 'Yes',
                vip_elevators: 'Yes'
            },
            
            // Test Case 5: Standoff Distance Issues
            standoffIssues: {
                has_standoff_measures: 'Yes',
                standoff_minimum_distance: 25, // Below recommended 50ft
                standoff_street_distance: 30,  // Below recommended 50ft
                standoff_blast_protection: '25+ ft' // Insufficient
            },
            
            // Test Case 6: Emergency Planning Gaps
            emergencyGaps: {
                emergency_plan_written: 'No',
                emergency_training_frequency: 'None',
                first_responder_contacts: 0,
                backup_power_system: 'No',
                evacuation_plan: 'No'
            },
            
            // Test Case 7: Complex Mixed Scenario
            complexScenario: {
                // Physical Security
                has_perimeter_barriers: 'Yes',
                standoff_perimeter_fencing: 'Wrought Iron',
                standoff_fence_height: 6,
                standoff_vehicle_barriers: 'Yes',
                vehicle_barrier_rating: 'K4',
                
                // Security Systems
                vss_present: 'Yes',
                vss_coverage: 'Full',
                els_present: 'Yes',
                access_control_system: 'Key Card',
                
                // Security Personnel
                secforce_247: 'Yes',
                secforce_armed: 'Yes',
                soc_present: 'Yes',
                
                // VIP Security
                vip_areas_present: 'Yes',
                vip_room_count: 5,
                vip_access_control: 'Yes',
                vip_security_staff: 'Yes',
                
                // Emergency Planning
                emergency_plan_written: 'Yes',
                emergency_training_frequency: 'Quarterly',
                first_responder_contacts: 3,
                backup_power_system: 'Yes'
            },
            
            // Test Case 8: Nested Data Structure
            nestedData: {
                sections: {
                    physical_security: {
                        has_perimeter_barriers: 'No',
                        standoff_minimum_distance: 25
                    },
                    security_systems: {
                        vss_present: 'No',
                        els_present: 'No'
                    },
                    vip_planning: {
                        vip_areas_present: 'No',
                        vip_security_staff: 'No'
                    }
                }
            }
        };
    }
    
    /**
     * Run all effectiveness tests
     */
    async runAllTests() {
        console.log('🧪 Starting VOFC Effectiveness Testing...');
        
        try {
            // Check if new system is available
            if (!window.vofcMatcher) {
                throw new Error('VOFC system not available. Make sure the system is loaded.');
            }
            
            // Run all test categories
            await this.runPerformanceTests();
            await this.runAccuracyTests();
            await this.runReliabilityTests();
            await this.runFunctionalityTests();
            
            // Calculate overall effectiveness
            this.calculateOverallEffectiveness();
            
            // Display results
            this.displayResults();
            
            console.log('✅ All effectiveness tests completed!');
            return this.testResults;
            
        } catch (error) {
            console.error('❌ Effectiveness testing failed:', error);
            throw error;
        }
    }
    
    /**
     * Run performance tests
     */
    async runPerformanceTests() {
        console.log('⚡ Running performance tests...');
        
        const testCases = Object.keys(this.testData);
        const iterations = 100;
        
        for (const testCase of testCases) {
            const data = this.testData[testCase];
            const times = [];
            
            // Test new system performance
            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                try {
                    window.vofcMatcher.analyzeAssessment(data);
                } catch (error) {
                    console.warn(`Performance test error in ${testCase}:`, error);
                }
                const endTime = performance.now();
                times.push(endTime - startTime);
            }
            
            // Calculate performance metrics
            const stats = this.calculateStats(times);
            this.testResults.performance[testCase] = {
                average: stats.average,
                min: stats.min,
                max: stats.max,
                median: stats.median,
                iterations: iterations,
                performance: this.ratePerformance(stats.average)
            };
        }
    }
    
    /**
     * Run accuracy tests
     */
    async runAccuracyTests() {
        console.log('🎯 Running accuracy tests...');
        
        const testCases = Object.keys(this.testData);
        
        for (const testCase of testCases) {
            const data = this.testData[testCase];
            
            try {
                const analysis = window.vofcMatcher.analyzeAssessment(data);
                
                // Analyze results
                const vulnerabilityCount = analysis.vulnerabilities?.length || 0;
                const optionCount = analysis.options?.length || 0;
                const overallScore = analysis.overallScore || 0;
                
                // Check for expected vulnerabilities based on test case
                const expectedVulns = this.getExpectedVulnerabilities(testCase, data);
                const detectedVulns = analysis.vulnerabilities?.map(v => v.id) || [];
                const accuracy = this.calculateAccuracy(expectedVulns, detectedVulns);
                
                this.testResults.accuracy[testCase] = {
                    vulnerabilityCount,
                    optionCount,
                    overallScore,
                    expectedVulnerabilities: expectedVulns,
                    detectedVulnerabilities: detectedVulns,
                    accuracy: accuracy,
                    accuracyRating: this.rateAccuracy(accuracy)
                };
                
            } catch (error) {
                console.warn(`Accuracy test error in ${testCase}:`, error);
                this.testResults.accuracy[testCase] = {
                    error: error.message,
                    accuracy: 0,
                    accuracyRating: 'Failed'
                };
            }
        }
    }
    
    /**
     * Run reliability tests
     */
    async runReliabilityTests() {
        console.log('🛡️ Running reliability tests...');
        
        const errorTestCases = [
            { name: 'null_data', data: null },
            { name: 'empty_data', data: {} },
            { name: 'invalid_data', data: 'invalid' },
            { name: 'circular_reference', data: this.createCircularReference() },
            { name: 'missing_sections', data: { sections: {} } }
        ];
        
        for (const testCase of errorTestCases) {
            try {
                const analysis = window.vofcMatcher.analyzeAssessment(testCase.data);
                
                this.testResults.reliability[testCase.name] = {
                    handled: true,
                    result: 'Graceful handling',
                    vulnerabilityCount: analysis.vulnerabilities?.length || 0,
                    optionCount: analysis.options?.length || 0
                };
                
            } catch (error) {
                this.testResults.reliability[testCase.name] = {
                    handled: false,
                    error: error.message,
                    errorType: error.constructor.name
                };
            }
        }
    }
    
    /**
     * Run functionality tests
     */
    async runFunctionalityTests() {
        console.log('🔧 Running functionality tests...');
        
        // Test system initialization
        const systemStats = window.vofcMatcher.getStats ? window.vofcMatcher.getStats() : null;
        
        // Test individual functions
        const functions = [
            'analyzeAssessment',
            'getVulnerabilityById',
            'getOptionsForVulnerability',
            'getStats',
            'clearCache'
        ];
        
        const functionTests = {};
        
        for (const funcName of functions) {
            try {
                if (typeof window.vofcMatcher[funcName] === 'function') {
                    functionTests[funcName] = {
                        available: true,
                        type: typeof window.vofcMatcher[funcName]
                    };
                } else {
                    functionTests[funcName] = {
                        available: false,
                        error: 'Function not found'
                    };
                }
            } catch (error) {
                functionTests[funcName] = {
                    available: false,
                    error: error.message
                };
            }
        }
        
        this.testResults.functionality = {
            systemStats,
            functionTests,
            overallFunctionality: this.calculateFunctionalityScore(functionTests)
        };
    }
    
    /**
     * Get expected vulnerabilities for test case
     */
    getExpectedVulnerabilities(testCase, data) {
        const expected = [];
        
        switch (testCase) {
            case 'noSecurity':
                expected.push('V001', 'V011', 'V013'); // No barriers, no VSS, no security
                break;
            case 'partialSecurity':
                expected.push('V015', 'V012'); // Partial VSS, no ELS
                break;
            case 'standoffIssues':
                expected.push('V008'); // Insufficient standoff distance
                break;
            case 'emergencyGaps':
                expected.push('V021', 'V022', 'V024', 'V025'); // Emergency planning gaps
                break;
            case 'vipSecurity':
                // Good VIP security - should have minimal vulnerabilities
                break;
            case 'goodSecurity':
                // Good overall security - should have minimal vulnerabilities
                break;
        }
        
        return expected;
    }
    
    /**
     * Calculate accuracy between expected and detected vulnerabilities
     */
    calculateAccuracy(expected, detected) {
        if (expected.length === 0 && detected.length === 0) return 100;
        if (expected.length === 0) return 0;
        
        const matches = expected.filter(vuln => detected.includes(vuln)).length;
        return (matches / expected.length) * 100;
    }
    
    /**
     * Calculate statistics from array of numbers
     */
    calculateStats(numbers) {
        if (numbers.length === 0) return { average: 0, min: 0, max: 0, median: 0 };
        
        const sorted = [...numbers].sort((a, b) => a - b);
        const average = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted.length % 2 === 0 ? 
            (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : 
            sorted[Math.floor(sorted.length / 2)];
        
        return { average, min, max, median };
    }
    
    /**
     * Rate performance based on average execution time
     */
    ratePerformance(averageTime) {
        if (averageTime < 10) return 'Excellent';
        if (averageTime < 50) return 'Good';
        if (averageTime < 100) return 'Fair';
        return 'Poor';
    }
    
    /**
     * Rate accuracy based on percentage
     */
    rateAccuracy(accuracy) {
        if (accuracy >= 90) return 'Excellent';
        if (accuracy >= 75) return 'Good';
        if (accuracy >= 50) return 'Fair';
        return 'Poor';
    }
    
    /**
     * Calculate functionality score
     */
    calculateFunctionalityScore(functionTests) {
        const totalFunctions = Object.keys(functionTests).length;
        const availableFunctions = Object.values(functionTests).filter(test => test.available).length;
        return (availableFunctions / totalFunctions) * 100;
    }
    
    /**
     * Create circular reference for testing
     */
    createCircularReference() {
        const obj = { test: 'value' };
        obj.self = obj;
        return obj;
    }
    
    /**
     * Calculate overall effectiveness
     */
    calculateOverallEffectiveness() {
        const performanceScore = this.calculatePerformanceScore();
        const accuracyScore = this.calculateAccuracyScore();
        const reliabilityScore = this.calculateReliabilityScore();
        const functionalityScore = this.testResults.functionality.overallFunctionality;
        
        this.testResults.overall = {
            performanceScore,
            accuracyScore,
            reliabilityScore,
            functionalityScore,
            overallEffectiveness: (performanceScore + accuracyScore + reliabilityScore + functionalityScore) / 4
        };
    }
    
    /**
     * Calculate performance score
     */
    calculatePerformanceScore() {
        const performances = Object.values(this.testResults.performance)
            .map(result => result.performance);
        
        const excellent = performances.filter(p => p === 'Excellent').length;
        const good = performances.filter(p => p === 'Good').length;
        const fair = performances.filter(p => p === 'Fair').length;
        
        return (excellent * 100 + good * 80 + fair * 60) / performances.length;
    }
    
    /**
     * Calculate accuracy score
     */
    calculateAccuracyScore() {
        const accuracies = Object.values(this.testResults.accuracy)
            .filter(result => result.accuracy !== undefined)
            .map(result => result.accuracy);
        
        return accuracies.length > 0 ? 
            accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length : 0;
    }
    
    /**
     * Calculate reliability score
     */
    calculateReliabilityScore() {
        const reliabilityTests = Object.values(this.testResults.reliability);
        const handled = reliabilityTests.filter(test => test.handled).length;
        return (handled / reliabilityTests.length) * 100;
    }
    
    /**
     * Display test results
     */
    displayResults() {
        console.log('\n🎯 VOFC Effectiveness Test Results');
        console.log('=====================================');
        
        console.log('\n⚡ Performance Results:');
        Object.entries(this.testResults.performance).forEach(([testCase, result]) => {
            console.log(`  ${testCase}: ${result.average.toFixed(2)}ms avg (${result.performance})`);
        });
        
        console.log('\n🎯 Accuracy Results:');
        Object.entries(this.testResults.accuracy).forEach(([testCase, result]) => {
            if (result.accuracy !== undefined) {
                console.log(`  ${testCase}: ${result.accuracy.toFixed(1)}% accuracy (${result.accuracyRating})`);
            } else {
                console.log(`  ${testCase}: Error - ${result.error}`);
            }
        });
        
        console.log('\n🛡️ Reliability Results:');
        Object.entries(this.testResults.reliability).forEach(([testCase, result]) => {
            console.log(`  ${testCase}: ${result.handled ? '✅ Handled' : '❌ Failed'}`);
        });
        
        console.log('\n🔧 Functionality Results:');
        console.log(`  Overall Functionality: ${this.testResults.functionality.overallFunctionality.toFixed(1)}%`);
        
        console.log('\n📊 Overall Effectiveness:');
        console.log(`  Performance Score: ${this.testResults.overall.performanceScore.toFixed(1)}%`);
        console.log(`  Accuracy Score: ${this.testResults.overall.accuracyScore.toFixed(1)}%`);
        console.log(`  Reliability Score: ${this.testResults.overall.reliabilityScore.toFixed(1)}%`);
        console.log(`  Functionality Score: ${this.testResults.overall.functionalityScore.toFixed(1)}%`);
        console.log(`  Overall Effectiveness: ${this.testResults.overall.overallEffectiveness.toFixed(1)}%`);
        
        if (this.testResults.overall.overallEffectiveness >= 80) {
            console.log('\n🎉 EXCELLENT: The refactored system is highly effective!');
        } else if (this.testResults.overall.overallEffectiveness >= 60) {
            console.log('\n✅ GOOD: The refactored system shows good effectiveness.');
        } else if (this.testResults.overall.overallEffectiveness >= 40) {
            console.log('\n⚠️ MODERATE: The refactored system shows moderate effectiveness.');
        } else {
            console.log('\n❌ POOR: The refactored system needs improvement.');
        }
    }
}

// Export for use
window.VOFCEffectivenessTest = VOFCEffectivenessTest;
