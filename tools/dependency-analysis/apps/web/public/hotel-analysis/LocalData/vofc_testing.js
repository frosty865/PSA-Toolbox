/**
 * VOFC System Testing Framework
 * Comprehensive testing to compare old vs new system effectiveness
 */

class VOFCTestingFramework {
    constructor() {
        this.testResults = {
            performance: {},
            accuracy: {},
            errorHandling: {},
            memoryUsage: {},
            overall: {}
        };
        this.testData = this.generateTestData();
        this.oldSystem = null;
        this.newSystem = null;
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
            }
        };
    }
    
    /**
     * Run comprehensive tests
     */
    async runAllTests() {
        console.log('🧪 Starting VOFC System Testing Framework...');
        
        try {
            // Initialize systems
            await this.initializeSystems();
            
            // Run performance tests
            await this.runPerformanceTests();
            
            // Run accuracy tests
            await this.runAccuracyTests();
            
            // Run error handling tests
            await this.runErrorHandlingTests();
            
            // Run memory usage tests
            await this.runMemoryUsageTests();
            
            // Generate final report
            this.generateTestReport();
            
            console.log('✅ All tests completed successfully!');
            return this.testResults;
            
        } catch (error) {
            console.error('❌ Testing failed:', error);
            throw error;
        }
    }
    
    /**
     * Initialize both old and new systems
     */
    async initializeSystems() {
        console.log('🔧 Initializing systems...');
        
        // Wait for systems to load
        await this.waitForSystems();
        
        // Initialize old system (if available)
        if (window.VOFC_VULNERABILITIES && window.VOFC_OPTIONS && typeof VOFCVulnerabilityMatcher !== 'undefined') {
            try {
                this.oldSystem = new VOFCVulnerabilityMatcher();
                console.log('✅ Old system initialized');
            } catch (error) {
                console.warn('⚠️ Old system initialization failed:', error.message);
                this.oldSystem = null;
            }
        } else {
            console.warn('⚠️ Old system not available - testing new system only');
            this.oldSystem = null;
        }
        
        // Initialize new system
        if (window.vofcMatcher) {
            this.newSystem = window.vofcMatcher;
            console.log('✅ New system initialized');
        } else {
            throw new Error('New system not available');
        }
    }
    
    /**
     * Wait for systems to load
     */
    async waitForSystems() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (window.VOFC_VULNERABILITIES && window.VOFC_OPTIONS && window.vofcMatcher) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 10000);
        });
    }
    
    /**
     * Run performance tests
     */
    async runPerformanceTests() {
        console.log('⚡ Running performance tests...');
        
        const testCases = Object.keys(this.testData);
        const iterations = 100; // Run each test 100 times for accuracy
        
        for (const testCase of testCases) {
            const data = this.testData[testCase];
            
            // Test new system performance
            const newSystemTimes = [];
            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                try {
                    this.newSystem.analyzeAssessment(data);
                } catch (error) {
                    console.warn(`New system error in ${testCase}:`, error);
                }
                const endTime = performance.now();
                newSystemTimes.push(endTime - startTime);
            }
            
            // Test old system performance (if available)
            let oldSystemTimes = [];
            if (this.oldSystem) {
                for (let i = 0; i < iterations; i++) {
                    const startTime = performance.now();
                    try {
                        this.oldSystem.analyzeAssessment(data);
                    } catch (error) {
                        console.warn(`Old system error in ${testCase}:`, error);
                    }
                    const endTime = performance.now();
                    oldSystemTimes.push(endTime - startTime);
                }
            } else {
                console.log(`  Skipping old system test for ${testCase} - not available`);
            }
            
            // Calculate statistics
            this.testResults.performance[testCase] = {
                newSystem: this.calculateStats(newSystemTimes),
                oldSystem: oldSystemTimes.length > 0 ? this.calculateStats(oldSystemTimes) : null,
                improvement: oldSystemTimes.length > 0 ? 
                    ((this.calculateStats(oldSystemTimes).average - this.calculateStats(newSystemTimes).average) / this.calculateStats(oldSystemTimes).average * 100) : null
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
            
            // Test new system accuracy
            let newSystemResults = null;
            try {
                newSystemResults = this.newSystem.analyzeAssessment(data);
            } catch (error) {
                console.warn(`New system error in ${testCase}:`, error);
            }
            
            // Test old system accuracy (if available)
            let oldSystemResults = null;
            if (this.oldSystem) {
                try {
                    oldSystemResults = this.oldSystem.analyzeAssessment(data);
                } catch (error) {
                    console.warn(`Old system error in ${testCase}:`, error);
                }
            }
            
            // Compare results
            this.testResults.accuracy[testCase] = {
                newSystem: {
                    vulnerabilityCount: newSystemResults?.vulnerabilities?.length || 0,
                    optionCount: newSystemResults?.options?.length || 0,
                    score: newSystemResults?.overallScore || 0
                },
                oldSystem: oldSystemResults ? {
                    vulnerabilityCount: oldSystemResults?.vulnerabilities?.length || 0,
                    optionCount: oldSystemResults?.options?.length || 0,
                    score: oldSystemResults?.overallScore || 0
                } : null,
                consistency: this.compareResults(newSystemResults, oldSystemResults)
            };
        }
    }
    
    /**
     * Run error handling tests
     */
    async runErrorHandlingTests() {
        console.log('🛡️ Running error handling tests...');
        
        const errorTestCases = [
            { name: 'null_data', data: null },
            { name: 'empty_data', data: {} },
            { name: 'invalid_data', data: 'invalid' },
            { name: 'missing_sections', data: { sections: {} } },
            { name: 'circular_reference', data: this.createCircularReference() }
        ];
        
        for (const testCase of errorTestCases) {
            // Test new system error handling
            let newSystemError = null;
            try {
                this.newSystem.analyzeAssessment(testCase.data);
            } catch (error) {
                newSystemError = error.message;
            }
            
            // Test old system error handling (if available)
            let oldSystemError = null;
            if (this.oldSystem) {
                try {
                    this.oldSystem.analyzeAssessment(testCase.data);
                } catch (error) {
                    oldSystemError = error.message;
                }
            }
            
            this.testResults.errorHandling[testCase.name] = {
                newSystem: newSystemError,
                oldSystem: oldSystemError,
                newSystemHandled: newSystemError !== null,
                oldSystemHandled: oldSystemError !== null
            };
        }
    }
    
    /**
     * Run memory usage tests
     */
    async runMemoryUsageTests() {
        console.log('💾 Running memory usage tests...');
        
        const iterations = 1000;
        
        // Test new system memory usage
        const newSystemMemory = [];
        for (let i = 0; i < iterations; i++) {
            const beforeMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
            try {
                this.newSystem.analyzeAssessment(this.testData.complexScenario);
            } catch (error) {
                // Ignore errors for memory test
            }
            const afterMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
            newSystemMemory.push(afterMemory - beforeMemory);
        }
        
        // Test old system memory usage (if available)
        let oldSystemMemory = [];
        if (this.oldSystem) {
            for (let i = 0; i < iterations; i++) {
                const beforeMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
                try {
                    this.oldSystem.analyzeAssessment(this.testData.complexScenario);
                } catch (error) {
                    // Ignore errors for memory test
                }
                const afterMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
                oldSystemMemory.push(afterMemory - beforeMemory);
            }
        }
        
        this.testResults.memoryUsage = {
            newSystem: this.calculateStats(newSystemMemory),
            oldSystem: oldSystemMemory.length > 0 ? this.calculateStats(oldSystemMemory) : null,
            improvement: oldSystemMemory.length > 0 ? 
                ((this.calculateStats(oldSystemMemory).average - this.calculateStats(newSystemMemory).average) / this.calculateStats(oldSystemMemory).average * 100) : null
        };
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
     * Compare results between old and new systems
     */
    compareResults(newResults, oldResults) {
        if (!newResults || !oldResults) return 'Cannot compare - missing results';
        
        const newVulns = newResults.vulnerabilities?.length || 0;
        const oldVulns = oldResults.vulnerabilities?.length || 0;
        const newOptions = newResults.options?.length || 0;
        const oldOptions = oldResults.options?.length || 0;
        
        const vulnDiff = Math.abs(newVulns - oldVulns);
        const optionDiff = Math.abs(newOptions - oldOptions);
        
        if (vulnDiff === 0 && optionDiff === 0) return 'Identical results';
        if (vulnDiff <= 1 && optionDiff <= 1) return 'Very similar results';
        if (vulnDiff <= 3 && optionDiff <= 3) return 'Similar results';
        return 'Different results';
    }
    
    /**
     * Create circular reference for error testing
     */
    createCircularReference() {
        const obj = { test: 'value' };
        obj.self = obj;
        return obj;
    }
    
    /**
     * Generate comprehensive test report
     */
    generateTestReport() {
        console.log('📊 Generating test report...');
        
        // Calculate overall effectiveness
        const performanceImprovement = this.calculateOverallPerformanceImprovement();
        const accuracyScore = this.calculateOverallAccuracyScore();
        const errorHandlingScore = this.calculateErrorHandlingScore();
        const memoryImprovement = this.testResults.memoryUsage.improvement || 0;
        
        // Calculate memory score if no old system comparison
        let memoryScore = memoryImprovement;
        if (memoryImprovement === 0) {
            // Rate based on memory usage alone
            const avgMemory = this.testResults.memoryUsage.newSystem?.average || 0;
            if (avgMemory < 1000) memoryScore = 100; // <1KB = excellent
            else if (avgMemory < 5000) memoryScore = 80; // <5KB = good
            else if (avgMemory < 10000) memoryScore = 60; // <10KB = fair
            else memoryScore = 40; // >=10KB = poor
        }
        
        this.testResults.overall = {
            performanceImprovement,
            accuracyScore,
            errorHandlingScore,
            memoryImprovement: memoryScore,
            overallEffectiveness: (performanceImprovement + accuracyScore + errorHandlingScore + memoryScore) / 4
        };
        
        // Display results
        this.displayTestResults();
    }
    
    /**
     * Calculate overall performance improvement
     */
    calculateOverallPerformanceImprovement() {
        const improvements = Object.values(this.testResults.performance)
            .filter(result => result.improvement !== null)
            .map(result => result.improvement);
        
        if (improvements.length > 0) {
            return improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;
        }
        
        // If no old system comparison, rate based on performance alone
        const newSystemTimes = Object.values(this.testResults.performance)
            .map(result => result.newSystem.average);
        
        if (newSystemTimes.length === 0) return 0;
        
        const averageTime = newSystemTimes.reduce((sum, time) => sum + time, 0) / newSystemTimes.length;
        
        // Rate performance: <10ms = 100%, <50ms = 80%, <100ms = 60%, >=100ms = 40%
        if (averageTime < 10) return 100;
        if (averageTime < 50) return 80;
        if (averageTime < 100) return 60;
        return 40;
    }
    
    /**
     * Calculate overall accuracy score
     */
    calculateOverallAccuracyScore() {
        const consistencies = Object.values(this.testResults.accuracy)
            .map(result => result.consistency);
        
        const identical = consistencies.filter(c => c === 'Identical results').length;
        const similar = consistencies.filter(c => c.includes('similar')).length;
        
        if (identical + similar > 0) {
            return (identical * 100 + similar * 80) / consistencies.length;
        }
        
        // If no old system comparison, rate based on vulnerability detection quality
        const accuracyResults = Object.values(this.testResults.accuracy);
        const totalVulns = accuracyResults.reduce((sum, result) => sum + (result.newSystem?.vulnerabilityCount || 0), 0);
        const totalOptions = accuracyResults.reduce((sum, result) => sum + (result.newSystem?.optionCount || 0), 0);
        
        // Rate based on detection capability: more vulnerabilities found = better accuracy
        // Expected range: 0-50 vulnerabilities, 0-50 options
        const vulnScore = Math.min(100, (totalVulns / accuracyResults.length) * 10); // Scale up
        const optionScore = Math.min(100, (totalOptions / accuracyResults.length) * 10); // Scale up
        
        return (vulnScore + optionScore) / 2;
    }
    
    /**
     * Calculate error handling score
     */
    calculateErrorHandlingScore() {
        const errorTests = Object.values(this.testResults.errorHandling);
        const newSystemHandled = errorTests.filter(test => test.newSystemHandled).length;
        const oldSystemHandled = errorTests.filter(test => test.oldSystemHandled).length;
        
        if (oldSystemHandled > 0) {
            return ((newSystemHandled - oldSystemHandled) / errorTests.length) * 100;
        }
        
        // If no old system comparison, rate based on error handling alone
        const handledPercentage = (newSystemHandled / errorTests.length) * 100;
        
        // Rate error handling: 100% = 100, 80%+ = 80, 60%+ = 60, <60% = 40
        if (handledPercentage >= 100) return 100;
        if (handledPercentage >= 80) return 80;
        if (handledPercentage >= 60) return 60;
        return 40;
    }
    
    /**
     * Display test results in console
     */
    displayTestResults() {
        console.log('\n🎯 VOFC System Testing Results');
        console.log('================================');
        
        console.log('\n⚡ Performance Results:');
        Object.entries(this.testResults.performance).forEach(([testCase, result]) => {
            console.log(`  ${testCase}:`);
            console.log(`    New System: ${result.newSystem.average.toFixed(2)}ms avg`);
            if (result.oldSystem) {
                console.log(`    Old System: ${result.oldSystem.average.toFixed(2)}ms avg`);
                console.log(`    Improvement: ${result.improvement?.toFixed(1)}%`);
            }
        });
        
        console.log('\n🎯 Accuracy Results:');
        Object.entries(this.testResults.accuracy).forEach(([testCase, result]) => {
            console.log(`  ${testCase}:`);
            console.log(`    New System: ${result.newSystem.vulnerabilityCount} vulns, ${result.newSystem.optionCount} options`);
            if (result.oldSystem) {
                console.log(`    Old System: ${result.oldSystem.vulnerabilityCount} vulns, ${result.oldSystem.optionCount} options`);
            }
            console.log(`    Consistency: ${result.consistency}`);
        });
        
        console.log('\n🛡️ Error Handling Results:');
        Object.entries(this.testResults.errorHandling).forEach(([testCase, result]) => {
            console.log(`  ${testCase}:`);
            console.log(`    New System: ${result.newSystemHandled ? '✅ Handled' : '❌ Failed'}`);
            if (result.oldSystem !== null) {
                console.log(`    Old System: ${result.oldSystemHandled ? '✅ Handled' : '❌ Failed'}`);
            }
        });
        
        console.log('\n💾 Memory Usage Results:');
        console.log(`  New System: ${this.testResults.memoryUsage.newSystem.average.toFixed(2)} bytes avg`);
        if (this.testResults.memoryUsage.oldSystem) {
            console.log(`  Old System: ${this.testResults.memoryUsage.oldSystem.average.toFixed(2)} bytes avg`);
            console.log(`  Improvement: ${this.testResults.memoryUsage.improvement?.toFixed(1)}%`);
        }
        
        console.log('\n📊 Overall Effectiveness:');
        console.log(`  Performance Score: ${this.testResults.overall.performanceImprovement.toFixed(1)}%`);
        console.log(`  Accuracy Score: ${this.testResults.overall.accuracyScore.toFixed(1)}%`);
        console.log(`  Error Handling Score: ${this.testResults.overall.errorHandlingScore.toFixed(1)}%`);
        console.log(`  Memory Score: ${this.testResults.overall.memoryImprovement.toFixed(1)}%`);
        console.log(`  Overall Effectiveness: ${this.testResults.overall.overallEffectiveness.toFixed(1)}%`);
        
        console.log('\n✅ Testing complete!');
    }
}

// Export for use
window.VOFCTestingFramework = VOFCTestingFramework;
